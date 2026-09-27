import { describe, expect, it } from 'vitest';
import { MAX_CAPTION_CHARS, parseBridgeMessage, reconnectDelay, safeBridgeUrl, withToken } from '../src/math/bridge';

describe('bridge protocol', () => {
  it('parses state messages and rejects unknown states', () => {
    expect(parseBridgeMessage('{"type":"state","state":"speaking"}')).toEqual({ type: 'state', state: 'speaking' });
    expect(parseBridgeMessage('{"type":"state","state":"dancing"}')).toBeNull();
  });

  it('parses and clamps level messages', () => {
    expect(parseBridgeMessage('{"type":"levels","level":0.5,"bass":2,"treble":-1}')).toEqual({
      type: 'levels', levels: { level: 0.5, bass: 1, treble: 0 },
    });
    expect(parseBridgeMessage('{"type":"levels","level":"loud"}')).toEqual({
      type: 'levels', levels: { level: 0, bass: 0, treble: 0 },
    });
  });

  it('parses captions and keeps the tail of long text', () => {
    expect(parseBridgeMessage('{"type":"caption","who":"user","text":"hi","final":true}')).toEqual({
      type: 'caption', who: 'user', text: 'hi', final: true,
    });
    const long = parseBridgeMessage(JSON.stringify({ type: 'caption', who: 'monk', text: 'x'.repeat(500) + 'END' }));
    expect(long?.type === 'caption' && long.text.endsWith('END') && long.text.length === MAX_CAPTION_CHARS + 1).toBe(true);
    expect(long?.type === 'caption' && long.final).toBe(false);
    expect(parseBridgeMessage('{"type":"caption","who":"someone","text":"x"}')).toBeNull();
  });

  it('parses info items, capped at three', () => {
    const msg = parseBridgeMessage(JSON.stringify({
      type: 'info',
      items: [{ kind: 'meeting', text: '1:1 at 3pm' }, { kind: 'weird', text: 'x' }, null, { text: 5 }, { kind: 'email', text: 'a' }, { kind: 'email', text: 'b' }],
    }));
    expect(msg).toEqual({
      type: 'info',
      items: [{ kind: 'meeting', text: '1:1 at 3pm' }, { kind: 'other', text: 'x' }, { kind: 'email', text: 'a' }],
    });
  });

  it('adds a token to the socket URL once', () => {
    expect(withToken('ws://10.0.0.5:8767/face', 'abc')).toBe('ws://10.0.0.5:8767/face?token=abc');
    expect(withToken('ws://h:1/face?token=zzz', 'abc')).toBe('ws://h:1/face?token=zzz');
    expect(withToken('ws://h:1/face', null)).toBe('ws://h:1/face');
  });

  it('parses tts framing and rejects silly rates', () => {
    expect(parseBridgeMessage('{"type":"tts","rate":22050}')).toEqual({ type: 'tts', rate: 22050 });
    expect(parseBridgeMessage('{"type":"tts","rate":5}')).toBeNull();
    expect(parseBridgeMessage('{"type":"tts_end"}')).toEqual({ type: 'tts_end' });
  });

  it('ignores garbage', () => {
    for (const raw of ['', 'not json', 'null', '42', '{"type":"other"}']) expect(parseBridgeMessage(raw)).toBeNull();
  });

  it('backs off to a cap', () => {
    expect(reconnectDelay(0)).toBe(500);
    expect(reconnectDelay(3)).toBe(4000);
    expect(reconnectDelay(20)).toBe(10_000);
  });
});

describe('safeBridgeUrl', () => {
  const fb = 'ws://127.0.0.1:8767/face';
  it('keeps same-host and loopback overrides', () => {
    expect(safeBridgeUrl('wss://192.168.1.5:8767/face', '192.168.1.5', fb)).toBe('wss://192.168.1.5:8767/face');
    expect(safeBridgeUrl('ws://localhost:9000/face', 'x', fb)).toBe('ws://localhost:9000/face');
  });
  it('rejects other hosts, other schemes and junk', () => {
    expect(safeBridgeUrl('wss://evil.example/face', '192.168.1.5', fb)).toBe(fb);
    expect(safeBridgeUrl('https://192.168.1.5/face', '192.168.1.5', fb)).toBe(fb);
    expect(safeBridgeUrl('not a url', '192.168.1.5', fb)).toBe(fb);
    expect(safeBridgeUrl(null, '192.168.1.5', fb)).toBe(fb);
  });
});
