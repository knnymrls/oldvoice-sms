const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

const db = {
  // User operations
  async createOrGetUser(phoneNumber) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();
    
    if (existingUser) {
      return existingUser;
    }
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ phone_number: phoneNumber })
      .select()
      .single();
    
    if (error) throw error;
    return newUser;
  },
  
  // Conversation operations
  async getActiveConversation(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  
  async createConversation(userId, state = 'initial', data = {}) {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        state,
        current_data: data,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      })
      .select()
      .single();
    
    if (error) throw error;
    return conversation;
  },
  
  async updateConversation(conversationId, state, data) {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .update({
        state,
        current_data: data,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      })
      .eq('id', conversationId)
      .select()
      .single();
    
    if (error) throw error;
    return conversation;
  },
  
  // Story request operations
  async createStoryRequest(userId, formData) {
    const { data: request, error } = await supabase
      .from('story_requests')
      .insert({
        user_id: userId,
        storyteller_name: formData.storyteller.name,
        storyteller_phone: formData.storyteller.phone,
        form_data: formData,
        scheduled_for: formData.scheduled_time === 'now' 
          ? new Date().toISOString() 
          : new Date(formData.scheduled_time).toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return request;
  },
  
  async updateStoryRequest(requestId, updates) {
    const { data, error } = await supabase
      .from('story_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async getPendingStoryRequests() {
    const { data, error } = await supabase
      .from('story_requests')
      .select('*')
      .in('status', ['pending', 'scheduled'])
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for');
    
    if (error) throw error;
    return data || [];
  },
  
  // SMS logging
  async logSMS(phoneNumber, direction, message) {
    const { error } = await supabase
      .from('sms_logs')
      .insert({
        phone_number: phoneNumber,
        direction,
        message
      });
    
    if (error) {
      console.error('Failed to log SMS:', error);
    }
  },
  
  // Cleanup
  async cleanupExpiredConversations() {
    const { error } = await supabase.rpc('cleanup_expired_conversations');
    if (error) {
      console.error('Failed to cleanup conversations:', error);
    }
  }
};

module.exports = db;