const express = require('express');
const router = express.Router();
const db = require('../lib/database');
const twilioService = require('../lib/twilio-client');
const vapiService = require('../lib/vapi-client');
const logger = require('../lib/logger');

// Vapi webhook endpoint
router.post('/webhook', async (req, res) => {
  try {
    logger.info('Vapi webhook received', { 
      headers: req.headers,
      bodyKeys: Object.keys(req.body),
      body: JSON.stringify(req.body, null, 2) 
    });
    
    // Vapi sends the event data in different formats depending on the event
    const eventData = req.body;
    const type = eventData.type || eventData.event?.type || eventData.message?.type;
    const call = eventData.call || eventData.data?.call || eventData;
    const assistant = eventData.assistant || eventData.data?.assistant;
    
    logger.info('Vapi webhook processed', { type, callId: call?.id });
    
    switch (type) {
      case 'call-started':
      case 'call.started':
        await handleCallStarted(call, assistant);
        break;
        
      case 'call-ended':
      case 'call.ended':
        await handleCallEnded(call);
        break;
        
      case 'transcript-ready':
      case 'transcript.ready':
      case 'call.transcript':
        await handleTranscriptReady(call);
        break;
        
      case 'recording-ready':
      case 'recording.ready':
      case 'call.recording':
        await handleRecordingReady(call);
        break;
        
      case 'speech-update':
      case 'speech.update':
        // Log speech updates but don't need to process them
        logger.debug('Speech update received', { 
          callId: call?.id,
          role: eventData.message?.role,
          status: eventData.message?.status 
        });
        break;
        
      case 'status-update':
      case 'status.update':
        logger.info('Call status update', {
          callId: call?.id,
          status: eventData.message?.status || call?.status
        });
        break;
        
      default:
        logger.warn('Unhandled webhook type', { type, body: req.body });
    }
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Vapi webhook error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleCallStarted(call, assistant) {
  logger.info('Call started', { callId: call.id, assistantId: assistant?.id });
  // Update story request status if needed
}

async function handleCallEnded(call) {
  try {
    logger.info('Call ended', { callId: call.id, duration: call.duration });
    
    // Find story request by call ID
    const { data: storyRequest } = await db.supabase
      .from('story_requests')
      .select('*')
      .eq('vapi_call_id', call.id)
      .single();
    
    if (!storyRequest) {
      logger.error('Story request not found for call', { callId: call.id });
      return;
    }
    
    // Update status
    await db.updateStoryRequest(storyRequest.id, {
      status: 'processing',
      duration_seconds: call.duration
    });
    
  } catch (error) {
    logger.error('Error handling call ended', error);
  }
}

async function handleTranscriptReady(call) {
  try {
    logger.info('Transcript ready for call', { callId: call.id });
    
    // Find story request
    const { data: storyRequest } = await db.supabase
      .from('story_requests')
      .select('*')
      .eq('vapi_call_id', call.id)
      .single();
    
    if (!storyRequest) {
      logger.error('Story request not found for call', { callId: call.id });
      return;
    }
    
    // Update with transcript
    await db.updateStoryRequest(storyRequest.id, {
      transcript: call.transcript
    });
    
  } catch (error) {
    logger.error('Error handling transcript', error);
  }
}

async function handleRecordingReady(call) {
  try {
    logger.info('Recording ready for call', { callId: call.id });
    
    // Find story request
    const { data: storyRequest } = await db.supabase
      .from('story_requests')
      .select('*, users!story_requests_user_id_fkey(phone_number)')
      .eq('vapi_call_id', call.id)
      .single();
    
    if (!storyRequest) {
      logger.error('Story request not found for call', { callId: call.id });
      return;
    }
    
    // Get full call details including recording
    const recording = await vapiService.getRecording(call.id);
    
    // Update story request
    await db.updateStoryRequest(storyRequest.id, {
      status: 'completed',
      recording_url: recording.recordingUrl,
      transcript: recording.transcript || call.transcript,
      completed_at: new Date().toISOString()
    });
    
    // Increment user's recording count
    await db.supabase.rpc('increment_user_recordings', {
      user_id_param: storyRequest.user_id
    });
    
    // Notify user
    const message = `Great news! The conversation with ${storyRequest.storyteller_name} is ready! 🎉\n\n` +
                   `Recording: ${recording.recordingUrl}\n\n` +
                   `Duration: ${Math.round(recording.duration / 60)} minutes\n\n` +
                   `The recording will be available for 30 days. Save it to keep it forever!`;
    
    await twilioService.sendSMS(storyRequest.users.phone_number, message);
    
  } catch (error) {
    logger.error('Error handling recording ready', error);
    
    // Try to notify user of failure
    try {
      const { data: storyRequest } = await db.supabase
        .from('story_requests')
        .select('*, users!story_requests_user_id_fkey(phone_number)')
        .eq('vapi_call_id', call.id)
        .single();
      
      if (storyRequest) {
        await twilioService.sendSMS(
          storyRequest.users.phone_number,
          `There was an issue processing the recording with ${storyRequest.storyteller_name}. We're looking into it.`
        );
        
        await db.updateStoryRequest(storyRequest.id, {
          status: 'failed'
        });
      }
    } catch (notifyError) {
      logger.error('Failed to notify user', notifyError);
    }
  }
}

module.exports = router;