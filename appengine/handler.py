# -*- coding: utf-8 -*-
import jinja2
import json
import logging
import os

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))

from google.appengine.api import channel
from google.appengine.api import memcache
from google.appengine.api import users
from google.appengine.ext import webapp


from protorpc import messages
from protorpc import protojson
from protorpc import remote
from protorpc.wsgi import service

logging.getLogger().setLevel(logging.DEBUG)

def get_user_id():
    user = users.get_current_user()
    if user and user.email():
        return user.email()
    return 'guest'

def clipboard_key():
  user_id = get_user_id()
  return 'clip' + (user_id or get_user_id())

def get_channel_token():
    return channel.create_channel(get_user_id())

class MainPage(webapp.RequestHandler):
    def get(self):
        if users.get_current_user():
            url = users.create_logout_url(self.request.uri)
            url_linktext = "Logout"
        else:
            url = users.create_login_url(self.request.uri)
            url_linktext = 'Login'

        channel_token = get_channel_token()

        template_values = {
            'url': url,
            'url_linktext': url_linktext,
            'channel_token': channel_token,
            'user_id': get_user_id(),
            'developer_mode': self.request.get('developer')
        }

        template = jinja_environment.get_template('index.html')
        self.response.out.write(template.render(template_values))

class FlushAll(webapp.RequestHandler):
    def get(self):
        memcache.flush_all()

class ClipboardMessage(messages.Message):
    body = messages.StringField(1, required=True)
    month = messages.StringField(2, required=True)
    day = messages.StringField(3, required=True)
    hours = messages.StringField(4, required=True)
    minutes = messages.StringField(5, required=True)
    sha1 = messages.StringField(6, required=True)

class EmptyRequest(messages.Message):
    pass

class EmptyResponse(messages.Message):
    pass

class ReloadRequest(messages.Message):
    user_id = messages.StringField(1, required=True)

class RemoveClipboardRequest(messages.Message):
    sha1 = messages.StringField(1, required=True)

class ClipboardHistory(messages.Message):
    history = messages.MessageField(ClipboardMessage, 1, repeated=True)

class ChannelResponse(messages.Message):
    channel_token = messages.StringField(1, required=True)

class SendClipboardsHistoryRequest(messages.Message):
    clipboard_history = messages.MessageField(ClipboardHistory, 1, required=True)

def get_clipboard_history():
    key = clipboard_key()
    if not memcache.get(key):
        set_clipboard_history(key, ClipboardHistory())
    history = memcache.get(key)
    if history:
        return protojson.decode_message(ClipboardHistory, history)
    else:
        return ClipboardHistory()

def set_clipboard_history(key, history):
    num = len(history.history)
    if num>100:
        history.history = history.history[1:]
    memcache.set(key, protojson.encode_message(history))

def remove_duplicate_clipboard(sha1):
    clipboard_history = get_clipboard_history()
    clipboard_history.history = clipboard_history.history or []
    clipboard_history.history = [x for x in clipboard_history.history if x.sha1 != sha1]
    return clipboard_history

    
class ClipboardService(remote.Service):

    @remote.method(EmptyRequest, ClipboardHistory)
    def getClipboards(self, request):
        return get_clipboard_history()

    @remote.method(ClipboardMessage, EmptyResponse)
    def sendClipboard(self, request):
        user_id = get_user_id()
        key = clipboard_key()
        clipboard_history = remove_duplicate_clipboard(request.sha1)
        clipboard_history.history.append(request)
        set_clipboard_history(key, clipboard_history)
        message = json.dumps({'type': "clipboard", 'body': request.body})
        channel.send_message(user_id, message)
        return EmptyResponse()

    @remote.method(RemoveClipboardRequest, ClipboardHistory)
    def removeClipboard(self, request):
        key = clipboard_key()
        clipboard_history = remove_duplicate_clipboard(request.sha1)
        set_clipboard_history(key, clipboard_history)
        return clipboard_history

    @remote.method(ReloadRequest, EmptyResponse)
    def reload(self, request):
        message = json.dumps({'type': "reload"})
        channel.send_message(request.user_id, message)
        return EmptyRequest()

    @remote.method(EmptyRequest, ChannelResponse)
    def getChannelToken(self, request):
        return ChannelResponse(channel_token=get_channel_token())

    @remote.method(SendClipboardsHistoryRequest, EmptyResponse)
    def sendClipboardsHistory(self, request):
        set_clipboard_history(clipboard_key(), request.clipboard_history)
        return EmptyResponse()

app = webapp.WSGIApplication([('/', MainPage),
                              ('/flush_all', FlushAll)],
                              debug = True)

app2 = service.service_mappings([('/rpc.*', ClipboardService)])
