const { google } = require('googleapis');
const { Handler } = require('htmlmetaparser');
const { Parser } = require('htmlparser2');
const got = require('got');
const catchify = require('catchify');

const SHEETS_AUTH = JSON.parse(process.env.SHEETS_AUTH);
const SHEETS_TOKEN = JSON.parse(process.env.SHEETS_TOKEN);

const SHEET_ID = '1XfU10Dl2eAuEVRSN2PI4xujdcjZMm4GdB33fv0Cz0hQ';

const parse = (html, url) => new Promise((res, err) => {
  const handler = new Handler((e, r) => {
    if (e) return err(e);
    return res(r);
  }, { url });
  const parser = new Parser(handler, { decodeEntities: true });
  parser.write(html);
  parser.done();
});

const makeBody = (title, meta = []) => {
  return `
<!doctype html>
<html lang="en-US">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        ${meta.map(({ key, item, value }) => `<meta ${key}="${item}" value="${value}">`).join('\n')}
    </head>
    <body></body> 
</html>
  `.trim();
};

const getMeta = (dataset, metaKey = 'name') => {
  return Object.keys(dataset).filter((k) => typeof dataset[k] === 'string').map((k) => ({
    key: metaKey,
    item: k,
    value: dataset[k],
  }));
};

exports.handler = async (event) => {
  const { client_id, client_secret, redirect_uris } = SHEETS_AUTH;
  const oauthClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oauthClient.setCredentials(SHEETS_TOKEN);

  const id = event.path.replace(/^\//, '');

  const sheets = google.sheets({ version: 'v4', auth: oauthClient });
  const data = (await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'A:D',
  })).data;

  const dict = data.values.slice(1).map((v) => ({
    id: v[0],
    to: v[1],
    url: v[2],
    opens: parseInt(v[3], 10),
  }));

  const idx = dict.findIndex((d) => d.id === id);

  if (idx < 0) {
    return {
      statusCode: 404,
    };
  }

  const opens = dict[idx].opens;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `D${idx + 2}`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[opens + 1]],
    },
  });

  const url = dict[idx].url;
  const [, body] = await catchify(got(url, {
    headers: {
      'User-Agent': 'mixl 1.0.0',
    },
  }).then((d) => d.body.toString()));

  const response = {
    statusCode: 302,
    headers: {
      Location: url,
    },
  };

  if (!body) {
    response.body = makeBody('A mixl.cc link from Matt');
  } else {
    const ds = await parse(body, url);
    const meta = [
      ...getMeta(ds.html, 'name'),
      ...(
        ds.rdfa ?
          getMeta(ds.rdfa['@graph'], 'name') :
          []
      ),
    ];
    response.body = makeBody('', meta)
  }

  return response;
};
