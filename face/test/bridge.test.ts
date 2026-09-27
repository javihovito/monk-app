import { describe, expect, it } from 'vitest';
import { parseBridgeMessage, reconnectDelay } from '../src/math/bridge';

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

  it('ignores garbage', () => {
    for (const raw of ['', 'not json', 'null', '42', '{"type":"other"}']) expect(parseBridgeMessage(raw)).toBeNull();
  });

  it('backs off to a cap', () => {
    expect(reconnectDelay(0)).toBe(500);
    expect(reconnectDelay(3)).toBe(4000);
    expect(reconnectDelay(20)).toBe(10_000);
  });
});
