const express = require('express');
const router = express.Router();
const db = require('../lib/database');
const twilioService = require('../lib/twilio-client');
const vapiService = require('../lib/vapi-client');

// Vapi webhook endpoint
router.post('/webhook', async (req, res) => {
  try {
    const { type, call, assistant } = req.body;
    
    console.log('Vapi webhook received:', { type, callId: call?.id });
    
    switch (type) {
      case 'call-started':
        await handleCallStarted(call, assistant);
        break;
        
      case 'call-ended':
        await handleCallEnded(call);
        break;
        
      case 'transcript-ready':
        await handleTranscriptReady(call);
        break;
        
      case 'recording-ready':
        await handleRecordingReady(call);
        break;
        
      default:
        console.log('Unhandled webhook type:', type);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Vapi webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleCallStarted(call, assistant) {
  console.log('Call started:', call.id);
  // Update story request status if needed
}

async function handleCallEnded(call) {
  try {
    console.log('Call ended:', call.id, 'Duration:', call.duration);
    
    // Find story request by call ID
    const { data: storyRequest } = await db.supabase
      .from('story_requests')
      .select('*')
      .eq('vapi_call_id', call.id)
      .single();
    
    if (!storyRequest) {
      console.error('Story request not found for call:', call.id);
      return;
    }
    
    // Update status
    await db.updateStoryRequest(storyRequest.id, {
      status: 'processing',
      duration_seconds: call.duration
    });
    
  } catch (error) {
    console.error('Error handling call ended:', error);
  }
}

async function handleTranscriptReady(call) {
  try {
    console.log('Transcript ready for call:', call.id);
    
    // Find story request
    const { data: storyRequest } = await db.supabase
      .from('story_requests')
      .select('*')
      .eq('vapi_call_id', call.id)
      .single();
    
    if (!storyRequest) {
      console.error('Story request not found for call:', call.id);
      return;
    }
    
    // Update with transcript
    await db.updateStoryRequest(storyRequest.id, {
      transcript: call.transcript
    });
    
  } catch (error) {
    console.error('Error handling transcript:', error);
  }
}

async function handleRecordingReady(call) {
  try {
    console.log('Recording ready for call:', call.id);
    
    // Find story request
    const { data: storyRequest } = await db.supabase
      .from('story_requests')
      .select('*, users!story_requests_user_id_fkey(phone_number)')
      .eq('vapi_call_id', call.id)
      .single();
    
    if (!storyRequest) {
      console.error('Story request not found for call:', call.id);
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
    console.error('Error handling recording ready:', error);
    
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
      console.error('Failed to notify user:', notifyError);
    }
  }
}

module.exports = router;