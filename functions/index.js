// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

// // Take the text parameter passed to this HTTP endpoint and insert it into the
// // Realtime Database under the path /messages/:pushId/original
// exports.addMessage = functions.https.onRequest((req, res) => {
//   console.log(req)
//   console.log(res)
//   // Grab the text parameter.
//   const original = req.query.text;
//   // Push the new message into the Realtime Database using the Firebase Admin SDK.
//   // return admin.database().ref('/messages').push({original: original}).then((snapshot) => {
//     // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
//     // return res.redirect(303, snapshot.ref.toString());
//     // return .post(
//     //   "https://hooks.slack.com/services/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",
//     //   { json: 
//     //     { text: 'message received'} 
//     //   }
//     // )
//     return res.contentType("json").status(200).send({
//       // "response_type": "ephemeral",
//       "text": "msg received"
//   });
//   // });
// });

exports.sendOwl = functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
      console.error(`Got unsupported ${request.method} request. Expected POST.`);
      return response.send(405, "Only POST requests are accepted");
  }
  
  let messageText = request.body.text
  let firstSpace = messageText.indexOf(' ')
  let mention = messageText.slice(0, firstSpace)
  let text = messageText.slice(firstSpace + 1)
  let currentUser = request.body.user_id

  return admin.database().ref("messages").push(request.body).then(()=> {
    console.log(request);
    return response.contentType("json").status(200).send({
      "response_type": "in_channel",
      "text": `<@${currentUser}> has sent an owl to ${mention}.`,
      "attachments": [
        {
          "text": `${text}`
        }
      ]
    });
  });
});