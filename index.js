import cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import dotenv from 'dotenv';
import moment from 'moment';

dotenv.config();

class BatchProcess {
  async runProcess() {
    try {
      await scrapping();
      console.log('✅success' + ' ' + moment().format('YYYY-MM-DD HH:mm:ss'));
      process.exit(0);
    } catch (err) {
      console.log(err.stack);
      process.exit(1);
    }
  }
}

async function scrapping() {
  try {
    const html = await axios.get('https://kboresale.com');

    const $ = cheerio.load(html.data);
    const contents = [];
    $('#tabs48937768878342144 > section')
      .children('article')
      .each((i, el) => {
        const content = $(el)
          .children('a')
          .find('span')
          .text()
          .trim()
          .replace(/\n|\t|\r|\n|\v|\f/g, '');

        if (content.indexOf('2장') > -1) {
          const id = $(el).children('a').attr().href.replace('https://kboresale.com/out-view/?seqTicketPrdt=', '');

          if (dbCheck(id)) {
            contents.push(content);
          }
        }
      });

    for (const content of contents) {
      console.log(content);
      await sendSlackMessage({
        url: process.env.SLACK_CHANNEL_URL,
        color: '#df793a',
        fallback: '⚾️ 리세일 등록',
        blocks: [
          { type: 'section', text: { text: '🎫 *리세일 등록*', type: 'mrkdwn' } },
          { type: 'section', text: { text: content, type: 'mrkdwn' } },
        ],
      });
    }
  } catch (err) {
    throw new Error(err.stack);
  }
}

function dbCheck(id) {
  const root = path.resolve();
  const filePath = `${root}/db.json`;
  const readId = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(readId);

  if (parsed.indexOf(id) === -1) {
    parsed.push(id);
    fs.writeFileSync(filePath, JSON.stringify(parsed), 'utf-8');
    return true;
  }
}

async function sendSlackMessage(params) {
  try {
    return await axios({
      url: params.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        attachments: [{ color: params.color, fallback: params.fallback, blocks: params.blocks }],
      },
    });
  } catch (err) {
    console.log(err.stack);
  }
}

cron.schedule('* * * * *', async () => await new BatchProcess().runProcess());
