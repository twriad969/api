const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

let tasks = {};
let completedTasks = [];
let totalTasksToday = 0;
let taskHistory = [];

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Image Processing Dashboard</title>
      <script src="https://cdn.tailwindcss.com/3.4.5"></script>
      <style>
        .skeleton {
          background: linear-gradient(90deg, rgba(165, 165, 165, 0.1) 25%, rgba(165, 165, 165, 0.2) 50%, rgba(165, 165, 165, 0.1) 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
        }

        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-left-color: #6366F1;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      </style>
    </head>
    <body class="bg-gradient-to-br from-gray-50 to-indigo-200 min-h-screen flex flex-col items-center justify-center font-sans">
      <div class="container mx-auto p-4">
        <h1 class="text-5xl font-extrabold text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Image Processing Dashboard</h1>

        <div id="stats" class="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-indigo-50 rounded-lg shadow">
              <p class="font-semibold text-indigo-700">Running Tasks</p>
              <p id="running-tasks-count" class="text-3xl font-bold text-indigo-900">0</p>
            </div>
            <div class="p-4 bg-indigo-50 rounded-lg shadow">
              <p class="font-semibold text-indigo-700">Total Tasks Today</p>
              <p id="total-tasks-today" class="text-3xl font-bold text-indigo-900">0</p>
            </div>
            <div class="p-4 bg-indigo-50 rounded-lg shadow">
              <p class="font-semibold text-indigo-700">Tasks Last Hour</p>
              <p id="tasks-last-hour" class="text-3xl font-bold text-indigo-900">0</p>
            </div>
            <div class="p-4 bg-indigo-50 rounded-lg shadow">
              <p class="font-semibold text-indigo-700">Tasks Last Minute</p>
              <p id="tasks-last-minute" class="text-3xl font-bold text-indigo-900">0</p>
            </div>
          </div>
        </div>

        <div id="status-container" class="space-y-4">
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
        </div>

        <div id="old-requests" class="space-y-4 mt-10">
          <h2 class="text-2xl font-bold text-gray-700 mb-4">Completed Tasks</h2>
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
        </div>
      </div>

      <div id="modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden">
        <div class="bg-white rounded-lg shadow-lg p-6 max-w-xl w-full relative">
          <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onclick="closeModal()">
            &times;
          </button>
          <h3 class="text-xl font-bold text-gray-700 mb-4">Task Details</h3>
          <p class="text-gray-700 mb-2"><span class="font-semibold">Task ID:</span> <span id="modal-task-id"></span></p>
          <div class="mb-2">
            <p class="text-gray-700 font-semibold">Source Image:</p>
            <img id="modal-source-image" class="w-full h-auto rounded-lg mt-2" src="" alt="Source Image">
            <a href="#" id="modal-source-url" class="text-indigo-500 text-sm mt-1 block truncate"></a>
          </div>
          <div class="mb-2">
            <p class="text-gray-700 font-semibold">Face Image:</p>
            <img id="modal-face-image" class="w-full h-auto rounded-lg mt-2" src="" alt="Face Image">
            <a href="#" id="modal-face-url" class="text-indigo-500 text-sm mt-1 block truncate"></a>
          </div>
          <div class="mb-4">
            <p class="text-gray-700 font-semibold">Result Image:</p>
            <img id="modal-result-image" class="w-full h-auto rounded-lg mt-2" src="" alt="Result Image">
          </div>
          <button class="mt-4 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600" onclick="closeModal()">Close</button>
        </div>
      </div>

      <script>
        const statusContainer = document.getElementById('status-container');
        const oldRequestsContainer = document.getElementById('old-requests');
        const runningTasksCountElem = document.getElementById('running-tasks-count');
        const totalTasksTodayElem = document.getElementById('total-tasks-today');
        const tasksLastHourElem = document.getElementById('tasks-last-hour');
        const tasksLastMinuteElem = document.getElementById('tasks-last-minute');
        const modal = document.getElementById('modal');
        const modalTaskId = document.getElementById('modal-task-id');
        const modalSourceImage = document.getElementById('modal-source-image');
        const modalSourceUrl = document.getElementById('modal-source-url');
        const modalFaceImage = document.getElementById('modal-face-image');
        const modalFaceUrl = document.getElementById('modal-face-url');
        const modalResultImage = document.getElementById('modal-result-image');

        function updateStats(stats) {
          runningTasksCountElem.textContent = stats.running;
          totalTasksTodayElem.textContent = stats.totalToday;
          tasksLastHourElem.textContent = stats.lastHour;
          tasksLastMinuteElem.textContent = stats.lastMinute;
        }

        function openModal(task) {
          modalTaskId.textContent = task.task_id;
          modalSourceImage.src = task.source_image;
          modalSourceUrl.href = task.source_image;
          modalSourceUrl.textContent = task.source_image;
          modalFaceImage.src = task.face_image;
          modalFaceUrl.href = task.face_image;
          modalFaceUrl.textContent = task.face_image;
          modalResultImage.src = task.result_image ? task.result_image : 'https://via.placeholder.com/150?text=Processing';
          modal.classList.remove('hidden');
        }

        function closeModal() {
          modal.classList.add('hidden');
        }

        function createTaskElement(task) {
          const timeTaken = (Date.now() - task.startTime) / 1000;
          return '<div class="bg-white shadow p-4 rounded-lg transition ease-in-out duration-200 flex justify-between items-center">' +
                  '<div>' +
                    '<p class="font-medium text-indigo-600 cursor-pointer hover:underline" onclick="openModal(' + encodeURIComponent(JSON.stringify(task)) + ')">Task ID: ' + task.task_id + '</p>' +
                    '<p>Status: ' + task.status + '</p>' +
                    '<p>Time Taken: ' + timeTaken.toFixed(2) + ' seconds</p>' +
                  '</div>' +
                  (task.status === 'Processing' ? '<div class="spinner"></div>' : '') +
                 '</div>';
        }

        function updateTaskList(container, tasks) {
          container.innerHTML = ''; // Clear previous content
          tasks.forEach(task => {
            container.innerHTML += createTaskElement(task);
          });
        }

        async function fetchStatus() {
          try {
            const response = await fetch('/status');
            const data = await response.json();
            updateStats(data.stats);
            updateTaskList(statusContainer, data.runningTasks);
            updateTaskList(oldRequestsContainer, data.oldTasks);
          } catch (error) {
            console.error('Error fetching status:', error.message);
          }
        }

        document.addEventListener('DOMContentLoaded', () => {
          setInterval(fetchStatus, 1000);
        });
      </script>
    </body>
    </html>
  `);
});

const formatErrorResponse = (error) => {
  return {
    status: 'error',
    message: error.response ? error.response.data : error.message,
  };
};

async function uploadImage(imagePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));

  try {
    const response = await axios.post('https://aifaceswap.io/api/upload_img', form, {
      headers: {
        ...form.getHeaders(),
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      },
    });
    return response.data.data;
  } catch (error) {
    throw formatErrorResponse(error);
  }
}

async function generateFace(sourceImage, faceImage) {
  const data = { source_image: sourceImage, face_image: faceImage };

  try {
    const response = await axios.post('https://aifaceswap.io/api/generate_face', data, {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      },
    });
    return response.data.data.task_id;
  } catch (error) {
    throw formatErrorResponse(error);
  }
}

async function checkStatus(taskId) {
  const data = { task_id: taskId };

  try {
    const response = await axios.post('https://aifaceswap.io/api/check_status', data, {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      },
    });
    return response.data;
  } catch (error) {
    throw formatErrorResponse(error);
  }
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

    const startTime = Date.now();
    tasks[taskId] = {
      task_id: taskId,
      status: 'Processing',
      startTime,
      source_image: targetImageUrl,
      face_image: faceImageUrl,
    };

    totalTasksToday++;
    taskHistory.push(startTime);

    let statusResponse;
    do {
      console.log('Checking status...');
      statusResponse = await checkStatus(taskId);
      if (statusResponse.data.status === 2) {
        tasks[taskId].status = 'Completed';
        tasks[taskId].result_image = statusResponse.data.result_image;
        completedTasks.push(tasks[taskId]);
        delete tasks[taskId];
      } else {
        tasks[taskId].status = 'Processing';
      }
      console.log('Current status:', statusResponse);

      if (statusResponse.data.status !== 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } while (statusResponse.data.status !== 2);

    console.log('Final status:', statusResponse);
    return statusResponse;
  } catch (error) {
    console.error('Error processing images:', error.message);
    throw error;
  }
}

function calculateStats() {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const oneMinuteAgo = now - 60000;

  const lastHourCount = taskHistory.filter(timestamp => timestamp >= oneHourAgo).length;
  const lastMinuteCount = taskHistory.filter(timestamp => timestamp >= oneMinuteAgo).length;

  return {
    running: Object.keys(tasks).length,
    totalToday: totalTasksToday,
    lastHour: lastHourCount,
    lastMinute: lastMinuteCount,
  };
}

app.get('/process', async (req, res) => {
  const { targetImageUrl, faceImageUrl } = req.query;

  if (!targetImageUrl || !faceImageUrl) {
    return res.status(400).json({ status: 'error', message: 'Both targetImageUrl and faceImageUrl are required.' });
  }

  try {
    const targetImageName = `${uuidv4()}.jpg`;
    const faceImageName = `${uuidv4()}.jpg`;

    const targetImagePath = path.join(__dirname, targetImageName);
    const faceImagePath = path.join(__dirname, faceImageName);

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
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/status', async (req, res) => {
  try {
    const stats = calculateStats();
    const runningTasks = Object.values(tasks);
    const oldTasks = completedTasks;

    res.json({ stats, runningTasks, oldTasks });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
