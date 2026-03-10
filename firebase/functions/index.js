const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();

exports.mailQueueCreated = onDocumentCreated('mailQueue/{mailId}', async (event) => {
  const payload = event.data?.data();
  const mailId = event.params.mailId;

  if (!payload) {
    logger.warn('mailQueue payload missing');
    return;
  }

  logger.info('mailQueue item received', payload);

  await admin.firestore().collection('mailQueueLogs').add({
    ...payload,
    receivedAt: new Date().toISOString(),
    status: 'received',
  });

  await admin.firestore().collection('mailQueue').doc(mailId).set(
    {
      status: 'sent',
      processedAt: new Date().toISOString(),
    },
    { merge: true },
  );
});
