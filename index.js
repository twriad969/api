const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;
async function uploadImage(imagePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));

  const response = await axios.post('https://aifaceswap.io/api/upload_img', form, {
    headers: {
      ...form.getHeaders(),
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'origin': 'https://aifaceswap.io',
      'priority': 'u=1, i',
      'referer': 'https://aifaceswap.io/',
      'sec-ch-ua': '"Not A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
      'x-requested-with': 'XMLHttpRequest'
    },
  });

  return response.data.data;
}

async function generateFace(sourceImage, faceImage) {
  const data = {
    source_image: sourceImage,
    face_image: faceImage
  };

  const response = await axios.post('https://aifaceswap.io/api/generate_face', data, {
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'origin': 'https://aifaceswap.io',
      'priority': 'u=1, i',
      'referer': 'https://aifaceswap.io/',
      'sec-ch-ua': '"Not A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
      'x-requested-with': 'XMLHttpRequest'
    },
  });

  return response.data.data.task_id;
}

async function checkStatus(taskId) {
  const data = {
    task_id: taskId
  };

  const response = await axios.post('https://aifaceswap.io/api/check_status', data, {
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'origin': 'https://aifaceswap.io',
      'priority': 'u=1, i',
      'referer': 'https://aifaceswap.io/',
      'sec-ch-ua': '"Not A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
      'x-requested-with': 'XMLHttpRequest'
    },
  });

  return response.data;
}

async function processImages(targetImagePath, faceImagePath) {
  try {
    console.log('Uploading target image...');
    const targetImageUrl = await uploadImage(targetImagePath);
    console.log('Target image uploaded:', targetImageUrl);

    console.log('Uploading face image...');
    const faceImageUrl = await uploadImage(faceImagePath);
    console.log('Face image uploaded:', faceImageUrl);

    console.log('Generating face swap...');
    const taskId = await generateFace(targetImageUrl, faceImageUrl);
    console.log('Face generation task ID:', taskId);

    let statusResponse;
    do {
      console.log('Checking status...');
      statusResponse = await checkStatus(taskId);
      console.log('Current status:', statusResponse);

      if (statusResponse.data.status !== 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } while (statusResponse.data.status !== 2);

    console.log('Final status:', statusResponse);
    return statusResponse;

  } catch (error) {
    console.error('Error processing images:', error.response ? error.response.data : error.message);
    throw error;
  }
}

app.get('/process', async (req, res) => {
  const { targetImageUrl, faceImageUrl } = req.query;

  if (!targetImageUrl || !faceImageUrl) {
    return res.status(400).send('Both targetImageUrl and faceImageUrl are required.');
  }

  try {
    const targetImageName = `${uuidv4()}.jpg`;
    const faceImageName = `${uuidv4()}.jpg`;

    const targetImagePath = path.join(__dirname, targetImageName);
    const faceImagePath = path.join(__dirname, faceImageName);

    // Download images from URLs
    const downloadImage = async (url, filepath) => {
      const response = await axios({
        url,
        responseType: 'stream',
      });
      return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
          .on('finish', resolve)
          .on('error', reject);
      });
    };

    await downloadImage(targetImageUrl, targetImagePath);
    await downloadImage(faceImageUrl, faceImagePath);

    const statusResponse = await processImages(targetImagePath, faceImagePath);
    res.json(statusResponse);
  } catch (error) {
    res.status(500).send('Error processing images: ' + (error.response ? error.response.data : error.message));
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
