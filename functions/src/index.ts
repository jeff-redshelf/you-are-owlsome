import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as rp from "request-promise";

admin.initializeApp();

export const oauth_redirect = functions.https.onRequest(async (request, response) => {
  if (request.method !== "GET") {
      console.error(`Got unsupported ${request.method} request. Expected GET.`);
      return response.status(405).send("Only GET requests are accepted");
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

  const result = await rp(options) as SlackOAuthResponse;;

  if (!result.ok) {
    console.error("The request was not ok: " + JSON.stringify(result));
    return response.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`).send(302);
  }

  await admin.database().ref("installations").child(result.team_id).set({
    token: result.access_token,
    team: result.team_id,
    webhook: {
        url: result.incoming_webhook.url,
        channel: result.incoming_webhook.channel_id
    }
  });

  return response.header("Location", `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com/slack_oauth_success.html`).send(302);
});

export const add_message = functions.https.onRequest(async (request, response) => {
  if (request.method !== "POST") {
    console.error(`Got unsupported ${request.method} request. Expected POST.`);
    return response.status(405).send("Only POST requests are accepted");
  }

  if (request.body.event && request.body.event.type === 'message') {
    await admin.database().ref('messages').push(request.body);
    return response.status(200);
  }

  if (request.body.challenge) {
    return response.contentType('json').status(200).send({
      'challenge': request.body.challenge
    });
  }
  
  return response.status(200);
});

export const process_message = functions.database.ref('messages/{id}').onWrite(async (event: any) => {
  if (!event.data.exists()) {
    return;
  }

  await event.data.ref.remove();

  const message = event.data.val();

  const installationRef = admin.database().ref("installations").child(message.team_id);
  const installation = (await installationRef.once("value")).val();

  const messageText = message.event.text;
  const containsOwl = messageText.indexOf(':owl:') > 0;

  if (containsOwl) {
    const re_mentions = /<(.*?)>/;
    const mentions = messageText.match(re_mentions);
    await admin.database().ref("owls").child(event.params.id).set({
      created_date: admin.database.ServerValue.TIMESTAMP,
      team: message.team_id,
      sent_by: message.event.user,
      mentions: mentions
    });
  }

});

export const sendOwl = functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
      console.error(`Got unsupported ${request.method} request. Expected POST.`);
      return response.status(405).send("Only POST requests are accepted");
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

interface SlackOAuthResponse {
  ok: boolean,
  access_token: string,
  scope: string,
  user_id: string,
  team_name: string,
  team_id: string,
  incoming_webhook: {
      channel: string,
      channel_id: string,
      configuration_url: string,
      url: string
  }
}