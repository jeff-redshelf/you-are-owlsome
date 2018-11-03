// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
const rp = require('request-promise');
admin.initializeApp();

exports.oauth_redirect = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
      console.error(`Got unsupported ${request.method} request. Expected GET.`);
      return response.send(405, "Only GET requests are accepted");
  }

  if (!request.query && !request.query.code) {
      return response.status(401).send("Missing query attribute 'code'");
  }

  const options = {
      uri: "https://slack.com/api/oauth.access",
      method: "GET",
      json: true,
      qs: {
          code: request.query.code,
          client_id: functions.config().slack.client_id,
          client_secret: functions.config().slack.client_secret,
          redirect_uri: `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/oauth_redirect`
      }
  };

  return rp(options).then((result) => {
    if (!result.ok) {
      console.error("The request was not ok: " + JSON.stringify(result));
      return response.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`).send(302);
    }

    return admin.database().ref("installations").child(result.team_id).set({
      token: result.access_token,
      team: result.team_id,
      webhook: {
          url: result.incoming_webhook.url,
          channel: result.incoming_webhook.channel_id
      }
    }).then(() => {
      return response.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/slack_oauth_success.html`).send(302);
    });
  });
});

exports.process_message = functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    console.error(`Got unsupported ${request.method} request. Expected POST.`);
    return response.send(405, "Only POST requests are accepted");
  }

  const messageText = request.body.event.text;
  const containsOwl = messageText.indexOf(':owl:') > 0;

  if (containsOwl) {
    return admin.database().ref('messages').push(request.body).then(() => {
      return response.send(200);
    })
  }
});

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

