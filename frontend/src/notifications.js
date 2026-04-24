// Web Push Notifications — SpaceSystem
// Uses Service Worker registration so notifications can appear when the
// tab is not focused (minimized, in background, or on another tab).

import { formatBRL, formatDate, todayISO } from './utils.js';

let swRegistration = null;

export function notificationsSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator;
}

export async function registerServiceWorker() {
  if (!notificationsSupported()) return null;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    // Ensure the SW is active before first use
    if (swRegistration.installing) {
      await new Promise((resolve) => {
        const sw = swRegistration.installing;
        if (!sw) return resolve();
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      });
    }
    return swRegistration;
  } catch (e) {
    console.warn('[notifications] SW registration failed:', e);
    return null;
  }
}

export async function ensureRegistration() {
  if (swRegistration) return swRegistration;
  if (!('serviceWorker' in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.ready;
    return swRegistration;
  } catch {
    return null;
  }
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Ask the user once for permission to show notifications. Tracked in
 * localStorage so we don't re-prompt on every load (browsers also throttle
 * repeated prompts). Call this after login so the prompt has user context.
 */
export async function requestNotificationPermission({ force = false } = {}) {
  if (!notificationsSupported()) return 'unsupported';
  const cur = Notification.permission;
  if (cur === 'granted' || cur === 'denied') return cur;

  const asked = localStorage.getItem('spacefy-notif-asked');
  if (asked === '1' && !force) return cur;

  try {
    const result = await Notification.requestPermission();
    localStorage.setItem('spacefy-notif-asked', '1');
    return result;
  } catch {
    return Notification.permission;
  }
}

/**
 * Trigger a payment-received notification. Safe to call even if notifications
 * are unsupported or denied — in that case it just no-ops.
 */
export async function showPaymentNotification(cob) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const title = '✅ Pagamento recebido!';
  const valorFmt = formatBRL(cob.valor);
  const dataFmt = formatDate(cob.data_pagamento || todayISO());
  const body = `Cliente: ${cob.cliente_nome || '—'} | Valor: ${valorFmt} | ${dataFmt}`;

  const options = {
    body,
    tag: `spacefy-payment-${cob.id}`,
    renotify: true,
    data: { cobrancaId: cob.id }
  };

  // Prefer SW registration so the notification fires even if the tab is
  // minimized / not focused.
  try {
    const reg = await ensureRegistration();
    if (reg && typeof reg.showNotification === 'function') {
      // Prefer postMessage to the SW so it owns the lifecycle (keeps working
      // even if the page is navigating away).
      if (reg.active) {
        reg.active.postMessage({
          type: 'spacefy-notify',
          payload: { title, options }
        });
      } else {
        await reg.showNotification(title, options);
      }
      return;
    }
  } catch (e) {
    console.warn('[notifications] SW show failed, falling back:', e);
  }

  // Fallback: foreground-only notification
  try {
    new Notification(title, options);
  } catch (e) {
    console.warn('[notifications] Notification() fallback failed:', e);
  }
}
