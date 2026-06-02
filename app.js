const { middleware, messagingApi } = require('@line/bot-sdk');
const express = require('express');
const cron = require('node-cron');
const path = require('path');
const db = require('./db/database');
const { pushScheduled } = require('./routes/scheduler');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'daycare2024';

const client = new messagingApi.MessagingApiClient(config);