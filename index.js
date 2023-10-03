const puppeteer = require("puppeteer");
const { Client, MessageMedia } = require("whatsapp-web.js");
const qr = require("qrcode-terminal");
const axios = require("axios");

const client = new Client();
let browser;

const RANDOM_IMAGE_URL = "https://picsum.photos/1080/720";
const IASK_URL = "https://iask.ai/?mode=question";
const SEARCH_ANIME_URL = "https://api.trace.moe/search?anilistInfo";

// Event listener for QR code
client.on("qr", (qrCode) => {
  qr.generate(qrCode, { small: true }, (qrcode) => {
    console.log(qrcode);
  });
});

// Event listener when the client is ready
client.on("ready", async () => {
  console.log("Client is ready!");

  const OwnChatID = client.info.wid._serialized;
  await client.sendMessage(OwnChatID, 'Successfully connected to WhatsApp Web!');
});

// Event listener for messages
client.on("message", async (msg) => {
  const messageBody = msg.body.toLocaleLowerCase();

  try {
    if (messageBody === "!ping") {
      msg.reply("pong");
    } else if (messageBody.includes("assalamualaikum")) {
      msg.reply("waalaikumussalam");
    } else if (messageBody === "!randomimage") {
      sendRandomImage(msg);
    } else if (messageBody.startsWith("!ask")) {
      sendIaskQuestionResponse(msg);
    } else if (messageBody === "!whatanime" && msg.hasMedia) {
      searchForAnime(msg);
    }
  } catch (error) {
    console.error("Error:", error);
    msg.reply("An error occurred.");
  }
});

// Function to send a random image as a response
async function sendRandomImage(msg) {
  try {
    const response = await axios.get(RANDOM_IMAGE_URL, { responseType: "arraybuffer" });

    const imageBase64 = Buffer.from(response.data).toString("base64");

    const media = new MessageMedia("image/jpg", imageBase64, "myimage.jpg");
    const caption = "Here's a random image!";

    await client.sendMessage(msg.from, media, { caption: caption });
  } catch (error) {
    console.error("Error fetching random image:", error);
    msg.reply("An error occurred while fetching a random image.");
  }
}

// Function to send a response to an iask question
async function sendIaskQuestionResponse(msg) {
  try {
    if (!browser) {
      browser = await puppeteer.launch();
    }

    const page = await browser.newPage();
    const prompt = msg.body.slice("!ask".length).trim();

    await page.goto(`${IASK_URL}&q=${prompt}#`);
    await page.waitForSelector("#output");

    const outputText = await page.$eval("#output #text", (element) => element.textContent);
    const cleanedText = outputText.replace(/\s+/g, " ");

    msg.reply(cleanedText);
  } catch (error) {
    console.error("Error sending iask request:", error);
    msg.reply("An error occurred while sending the iask request.");
  }
}

// Function to search for anime information and send it as a response
async function searchForAnime(msg) {
  try {
    const media = await msg.downloadMedia();
    const imageBuffer = Buffer.from(media.data, "base64");

    const response = await axios.post(SEARCH_ANIME_URL, imageBuffer, {
      headers: {
        "Content-Type": media.mimetype
      }
    });

    if (!response.data.error) {
      const animeInfo = response.data.result[0];

      if (animeInfo) {
        const anilistInfo = animeInfo.anilist;

        const { native = '', romaji = '', english = '' } = anilistInfo.title;
        const animeTitle = `${native} (${romaji}) - ${english}`;

        const episode = animeInfo.episode;
        const similarity = (animeInfo.similarity * 100).toFixed(2);
        const isAdult = anilistInfo.isAdult;

        const fromTime = formatTime(animeInfo.from);
        const toTime = formatTime(animeInfo.to);

        const imageUrl = animeInfo.image;
        const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const imageBase64 = Buffer.from(imageResponse.data).toString("base64");

        const media = new MessageMedia("image/jpg", imageBase64, "anime_image.jpg");
        const caption = `Anime: ${animeTitle}\nEpisode: ${episode}\nSimilarity: ${similarity}%\nIs Adult: ${isAdult ? 'Yes' : 'No'}\nTimestamp: ${fromTime} - ${toTime}`;

        await client.sendMessage(msg.from, media, { caption: caption });
      } else {
        msg.reply("Anime not found.");
      }
    } else {
      msg.reply("An error occurred while searching for anime.");
    }
  } catch (error) {
    console.error("Error searching for anime:", error);
    msg.reply("An error occurred while searching for anime.");
  }
}

// Function to format time in seconds to the "mm:ss" 
function formatTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.round(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Initialize the client after setting event listeners
client.initialize();
