=begin
#==============================================================================
 Title: Casting Time
 Author: Hime
 Date: Aug 21, 2015
------------------------------------------------------------------------------
 ** Change log
 Aug 21, 2015
   - store entire action, not just the skill/item to use
 Mar 12, 2014
   - removes an extra action display
 Sep 21, 2012
   - added "state added" battle log message
 Aug 26, 2012
   - added "suspended" state
   - fixed bug where using item crashes the game
 Aug 25, 2012
   - initial release
------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in commercial/non-commercial projects
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Credits to Hime Works in your project
 * Preserve this header
--------------------------------------------------------------------------------
 ** Description
 
 This script allows you to specify the amount of time that must pass
 before your skill is executed. Time is specified in "turns" but can be
 modified to support frames for active battle systems.
 
 It uses a "casting" state to in order to determine whether you are in the
 middle of casting the spell.
 
 The battler cannot accept any commands while in the casting state.
 
 When the amount of time required to cast the spell has passed, if the
 battler is still casting, then the cast state will be removed and the
 skill executed.
 
 A "suspended" state is available to pause the casting. When the suspended
 state is inflicted, the battler will still be casting, but the countdown
 does not change. When the suspended state is removed, the countdown will
 resume.
 
 When the casting state is removed, the battler's reserved casting skill will
 be removed as well, and control goes back to the battler.
--------------------------------------------------------------------------------
 ** Installation
 
 In the script editor, place this script below Materials and above Main
 
--------------------------------------------------------------------------------
 ** Usage
 
 Note-tag items or skills with 
 
    <cast-time: n>
    
 Where `n` is a number, to specify the number of turns the battler must wait
 until the action is executed.
 
 In the configuration, you can choose the states that will be applied whenever
 the battler is casting or suspended.
#==============================================================================
=end
$imported = {} if $imported.nil?
$imported["Tsuki_CastingTime"] = true
#==============================================================================
# ** Configuration
#==============================================================================
module Tsuki
  module CastingTime
    
    # state to inflict when the battler is preparing for a skill
    Cast_State = 97
    
    # state to inflict when the casting should be paused
    Suspended_State = 98
    
    Cast_Time_Regex = /<cast[-_ ]time:\s*(\d+)>/i
  end
end
#==============================================================================
# ** Rest of script
#==============================================================================
module RPG
  class UsableItem
    
    # amount of time required to cast this skill
    def cast_time
      return @cast_time unless @cast_time.nil?
      r = Tsuki::CastingTime::Cast_Time_Regex.match(self.note) 
      return @cast_time = r ? r[1].to_i : 0
    end
  end
end

class Game_Action
   
  def cast_time
    return item ? item.cast_time : 0
  end
end

class Game_Battler
  attr_reader :casting_action
  attr_reader :casting_time
  
  alias :th_cast_time_init :initialize
  def initialize
    th_cast_time_init
    @casting_action = nil
    @casting_time = 0
  end
  
  # clear all casting 
  def clear_casting
    @casting_action = nil
    @casting_time = 0
  end
  
  def casting_state_id
    Tsuki::CastingTime::Cast_State
  end
  
  def suspend_casting_state_id
    Tsuki::CastingTime::Suspended_State
  end
  
  def casting?
    @states.include?(casting_state_id)
  end
  
  def suspend_casting?
    @states.include?(suspend_casting_state_id)
  end

  alias :th_cast_time_turn_end :on_turn_end
  def on_turn_end
    th_cast_time_turn_end
    update_cast_time unless suspend_casting?
  end
  
  alias :th_cast_time_battle_end :on_battle_end
  def on_battle_end
    th_cast_time_battle_end
    clear_casting
  end
  
  # decrease by 1 per turn (although it could be arbitrary in the future...)
  def update_cast_time
    @casting_time = [@casting_time - 1, 0].max
  end
  
  # determine whether we are going to cast, or starting to cast
  def check_cast_time
    if casting?
      if @casting_action && @casting_time <= 0
        execute_cast_action
        clear_casting
      end
    elsif suspend_casting?
      return false
    elsif current_action && current_action.cast_time > 0
      prepare_cast_time
      return true
    else
      clear_casting
    end
  end
  
  # automatically set up actions based on the casting
  def execute_cast_action
    remove_state(casting_state_id)
    clear_actions
    @actions.push(@casting_action)
  end  
  
  # initiate casting
  def prepare_cast_time
    @casting_action = current_action.clone
    @casting_time = current_action.cast_time
    add_state(casting_state_id)
    @result.used = true
    @result.success = true
    @result.hp_damage = 0
    
    # action has been stored so we can just clear it out
    remove_current_action
  end
end

class Scene_Battle
  
  #-----------------------------------------------------------------------------
  # Skip command input if casting
  #-----------------------------------------------------------------------------
  alias :th_cast_time_start_actor_command_selection :start_actor_command_selection 
  def start_actor_command_selection
    if BattleManager.actor.casting?
      next_command 
    else
      th_cast_time_start_actor_command_selection
    end
  end
  
  # replace...might be bad
  def process_action
    return if scene_changing?
    if !@subject || !@subject.current_action
      @subject = BattleManager.next_subject
    end
    return turn_end unless @subject
    
    @subject.check_cast_time # new line
    
    if @subject.current_action
      @subject.current_action.prepare
      if @subject.current_action.valid?
        @status_window.open
        execute_action
      end
      @subject.remove_current_action 
    end
    process_action_end unless @subject.current_action
  end
end