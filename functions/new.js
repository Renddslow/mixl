const { google } = require('googleapis');
const pokemon = require('pokemon');

const SHEETS_AUTH = JSON.parse(process.env.SHEETS_AUTH);
const SHEETS_TOKEN = JSON.parse(process.env.SHEETS_TOKEN);

const SHEET_ID = '1XfU10Dl2eAuEVRSN2PI4xujdcjZMm4GdB33fv0Cz0hQ';

const hash = (str) => {
  let hashVal;
  let chr;
  let len;
  let i;

  if (str.length === 0) return hashVal;

  for (i = 0, len = str.length; i < len; i++) {
    chr = str.charCodeAt(i);
    hashVal = (hashVal << 5) - hashVal + chr;
    hashVal |= 0; // Convert to 32bit integer
  }

  return Math.abs(hashVal).toString(16);
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405
    };
  }

  const body = JSON.parse(event.body);
  const to = body.to || '*';
  const url = body.url;
  const id = hash(`${pokemon.random()}:${to}:${url}`);

  const { client_id, client_secret, redirect_uris } = SHEETS_AUTH;
  const oauthClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oauthClient.setCredentials(SHEETS_TOKEN);

  const sheets = google.sheets({ version: 'v4', auth: oauthClient });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `A:D`,
    insertDataOption: 'INSERT_ROWS',
    valueInputOption: 'RAW',
    resource: {
      values: [[
        id,
        to,
        url,
        0,
      ]]
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      id,
      to,
      url,
      opens: 0,
    }),
  };
};
