'use strict';

// PLANTED RISK: this "cleanup" migration looks harmless in a PR, but it deletes
// data and has no down(). Once it ships, a rollback cannot bring the column back.
// `npm run check:migrations` is the pre-deploy check that should stop it.
//
// It lives in migrations/pending/ so the app never applies it by accident.
exports.up = (db) => {
  db.exec('ALTER TABLE tenants DROP COLUMN legacy_contact;');
};
