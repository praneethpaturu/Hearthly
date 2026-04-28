// In-process MQTT broker (aedes) + an internal client for publish/subscribe.
// Real devices would speak the same protocol; here the admin UI and a local
// simulator publish to the same broker so the demo behaves like prod.
import { createServer } from 'net';
import Aedes from 'aedes';
import mqtt from 'mqtt';

export async function startBroker(port) {
  const aedes = new Aedes();
  const server = createServer(aedes.handle);
  await new Promise((resolve) => server.listen(port, resolve));
  return aedes;
}

export function createClient(port) {
  return mqtt.connect(`mqtt://127.0.0.1:${port}`, { reconnectPeriod: 1000 });
}

// Topic helpers — kept in one place so the contract is easy to audit.
export const topics = {
  telemetry: (community, device) => `valet/${community}/${device}/telemetry`,
  event:     (community, device) => `valet/${community}/${device}/event`,
  scan:      (community, device) => `valet/${community}/${device}/scan`,
  cmd:       (community, device) => `valet/${community}/${device}/cmd`,
};
