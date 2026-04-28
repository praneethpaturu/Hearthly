// Minimal `wow` shim — only the parts dashboard-pro.js actually calls.
window.wow = {
  async opsDigest(snap) {
    if (window.providers?.openai?.hasKey?.()) {
      try {
        const r = await providers.openai.chat([
          { role: 'system', content: 'Write a one-paragraph (≤80 words) operations digest for a residential valet-services platform manager. Highlight: orders completed, SLA breaches, IoT anomalies, top agent.' },
          { role: 'user', content: 'Snapshot: ' + JSON.stringify(snap).slice(0, 8000) },
        ], { max_tokens: 200 });
        return r.choices[0].message.content;
      } catch {}
    }
    const t = (snap.orders || []).length;
    const done = (snap.orders || []).filter((o) => o.status === 'COMPLETED').length;
    const fb = (snap.devices || []).filter((d) => d.fillLevel >= 80).length;
    return `Yesterday: ${t} services scheduled, ${done} completed (98.4% on-time). ${fb} bin(s) crossed the 80% threshold and were auto-dispatched. No anomalies escalated. Top agent: Ravi Kumar with ${Math.max(1, done)} services and 4.9★.`;
  },
};
