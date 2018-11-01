// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

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
      "text": `<@${currentUser}> thinks ${mention} is owlsome.`,
      "attachments": [
        {
          "text": `${text}`
        }
      ]
    });
  });
});