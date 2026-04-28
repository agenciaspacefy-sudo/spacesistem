import Stripe from 'stripe';
import db from './db.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
  console.log('[stripe] SDK habilitado');
} else {
  console.warn('[stripe] STRIPE_SECRET_KEY não configurada — webhook desabilitado');
}

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn('[stripe] STRIPE_WEBHOOK_SECRET não configurada — assinatura do webhook NÃO será validada');
}

// Determina o plano (mensal/anual) a partir de uma Subscription do Stripe.
// Olha o intervalo do primeiro item (month -> mensal, year -> anual).
function planoFromSubscription(sub) {
  try {
    const item = sub?.items?.data?.[0];
    const interval = item?.price?.recurring?.interval || item?.plan?.interval;
    if (interval === 'year') return 'anual';
    if (interval === 'month') return 'mensal';
  } catch {}
  return 'mensal'; // fallback razoável
}

function findUserByEmail(email) {
  if (!email) return null;
  return db
    .prepare('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)')
    .get(email);
}

function findUserByCustomerId(customerId) {
  if (!customerId) return null;
  return db
    .prepare('SELECT * FROM usuarios WHERE stripe_customer_id = ?')
    .get(customerId);
}

function findUserBySubscriptionId(subId) {
  if (!subId) return null;
  return db
    .prepare('SELECT * FROM usuarios WHERE stripe_subscription_id = ?')
    .get(subId);
}

async function handleCheckoutCompleted(session) {
  const email = session.customer_details?.email || session.customer_email;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  // Tenta achar o usuário por email primeiro (link público de pagamento).
  // Em fallback, tenta pelo customerId (caso já estivesse vinculado).
  let user = findUserByEmail(email) || findUserByCustomerId(customerId);
  if (!user) {
    console.warn(`[stripe] checkout.session.completed sem usuário correspondente — email=${email} customer=${customerId}`);
    return;
  }

  let plano = 'mensal';
  if (subscriptionId && stripe) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      plano = planoFromSubscription(sub);
    } catch (e) {
      console.warn('[stripe] falha ao buscar subscription:', e.message);
    }
  }

  db.prepare(
    `UPDATE usuarios
     SET stripe_customer_id = COALESCE(?, stripe_customer_id),
         stripe_subscription_id = COALESCE(?, stripe_subscription_id),
         plano = ?,
         assinatura_ativa = 1
     WHERE id = ?`
  ).run(customerId || null, subscriptionId || null, plano, user.id);

  console.log(`[stripe] usuário ${user.email} ativado no plano ${plano}`);
}

function handleSubscriptionDeleted(sub) {
  const subId = sub.id;
  let user = findUserBySubscriptionId(subId);
  if (!user) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    user = findUserByCustomerId(customerId);
  }
  if (!user) {
    console.warn(`[stripe] subscription.deleted sem usuário — sub=${subId}`);
    return;
  }

  db.prepare(
    `UPDATE usuarios
     SET assinatura_ativa = 0,
         plano = 'expirado'
     WHERE id = ?`
  ).run(user.id);

  console.log(`[stripe] usuário ${user.email} teve assinatura cancelada — acesso bloqueado`);
}

function handlePaymentFailed(invoice) {
  const email = invoice.customer_email || '(sem email)';
  const customerId = invoice.customer;
  const valor = (invoice.amount_due || 0) / 100;
  console.warn(`[stripe] PAGAMENTO FALHOU — customer=${customerId} email=${email} valor=R$${valor.toFixed(2)}`);
  // TODO: enviar email/notificação ao admin no futuro
}

export default async function stripeWebhookHandler(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe não configurado no servidor' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  if (STRIPE_WEBHOOK_SECRET) {
    try {
      // req.body é Buffer aqui (express.raw)
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn('[stripe] assinatura inválida:', err.message);
      return res.status(400).send(`Webhook signature error: ${err.message}`);
    }
  } else {
    // Sem segredo configurado: parse simples (somente para teste local).
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).send('Invalid payload');
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.deleted':
        handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_failed':
        handlePaymentFailed(event.data.object);
        break;

      // Outros eventos comuns que apenas registramos
      case 'customer.subscription.updated':
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        // sem ação dedicada por ora
        break;

      default:
        // Outros eventos — ignora silenciosamente
        break;
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[stripe] erro processando webhook:', e);
    res.status(500).json({ error: 'webhook processing failed' });
  }
}
