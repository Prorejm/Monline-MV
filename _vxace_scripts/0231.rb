=begin
#==============================================================================
 ** Mime Effect
 Author: Hime
 Date: Sep 4, 2012
------------------------------------------------------------------------------
 ** Change log
 Sep 4
   - properly set the subject of the new action when duping the action
   - re-ordered the last action recording to take place before the item usage
 Aug 30
   - fixed bug where script crashes if battler has no current action
 Aug 25
   - initial release
------------------------------------------------------------------------------   
 A mime effect is an effect on a skill or item that copies the most recent
 action performed by an ally.
 
 To set a mime effect, tag the skill or item with <mime>
 Skills or items with mime effect will automatically override its scope.
 
 Note that it only copies the most recent action performed, and does not
 copy all actions performed by the previous ally (for example, if your
 actor performed 5 actions in a row)  
 
 It also copies forced actions.
#==============================================================================
=end
$imported = {} if $imported.nil?
$imported["Tsuki_Mime_Effect"] = true
#==============================================================================
# ** Configuration
#==============================================================================
module Tsuki
  module Mime_Effect
  end
end
#==============================================================================
# ** Configuration
#==============================================================================
class RPG::UsableItem

  # checks whether the item is a mime item
  def mime_effect?
    return self.note[/<mime>/i] != nil
  end
  
  alias :th_mime_skill_need_selection? :need_selection?
  def need_selection?
    return false if mime_effect?
    return th_mime_skill_need_selection?
  end
end

class Game_Unit
  attr_accessor :last_action   # most recent action performed
  
  alias :th_mime_skill_init :initialize
  def initialize
    th_mime_skill_init
    @last_action = nil
  end
  
  alias :th_mime_skill_on_battle_end :on_battle_end
  def on_battle_end
    th_mime_skill_on_battle_end
    @last_action = nil
  end
end

class Scene_Battle
    
  # replace action if using mime
  alias :th_mime_skill_exec_act :execute_action  
  def execute_action
    check_mime_action
    th_mime_skill_exec_act
  end
  
  # New. Checks whether the current action is a mime skill
  def check_mime_action
    item = @subject.current_action.item
    if item.mime_effect?
      replace_action
      @subject.use_item(item) # mime item usage
    end
  end
  
  # New. Grabs the last action and sets it as the battler's skill
  def replace_action
    unit = @subject.current_action.friends_unit
    if unit.last_action
      @subject.actions[0] = unit.last_action.dup
      @subject.actions[0].set_subject(@subject)
    end
  end
  
  alias :th_mime_skill_use_item :use_item
  def use_item
    @subject.current_action.friends_unit.last_action = @subject.current_action ? @subject.current_action.dup : nil
    th_mime_skill_use_item
  end
end

class Game_Action
  
  # just change the subject
  def set_subject(subject)
    @subject = subject
  end
end