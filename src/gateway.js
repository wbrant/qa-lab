'use strict';

// A fake payment gateway with Stripe-style test cards. No network, no real money.
//   4242424242424242  -> succeeds immediately
//   4000000000003220  -> requires a 3DS challenge, then pass/fail
//   4000000000000002  -> declined
const CARDS = {
  '4242424242424242': 'succeeded',
  '4000000000003220': 'requires_action',
  '4000000000000002': 'declined',
};

class Gateway {
  constructor() {
    this.intents = new Map();
    this.counter = 0;
  }

  createIntent({ amount, card }) {
    const id = `pi_test_${++this.counter}`;
    const number = String(card || '').replace(/\s/g, '');
    let status;
    let error = null;
    if (!/^\d{13,19}$/.test(number)) {
      status = 'failed';
      error = 'invalid_card';
    } else {
      const kind = CARDS[number];
      if (kind === 'succeeded') status = 'succeeded';
      else if (kind === 'requires_action') status = 'requires_action';
      else {
        status = 'failed';
        error = 'card_declined';
      }
    }
    const intent = { id, amount, status, error };
    this.intents.set(id, intent);
    return { ...intent };
  }

  // Simulates the customer finishing the 3DS challenge.
  completeAuthentication(id, result) {
    const intent = this.intents.get(id);
    if (!intent || intent.status !== 'requires_action') return null;
    if (result === 'pass') {
      intent.status = 'succeeded';
    } else {
      intent.status = 'failed';
      intent.error = 'authentication_failed';
    }
    return { ...intent };
  }
}

module.exports = { Gateway };
