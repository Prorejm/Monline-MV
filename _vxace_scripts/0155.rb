=begin
#==============================================================================
 ** Effect: Thorn Armor
 Author: Hime
 Date: May 14, 2013
------------------------------------------------------------------------------
 ** Change log
 May 14, 2013
   - refactored
 Oct 8, 2012
   - initial release
------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Preserve this header
------------------------------------------------------------------------------
 Adds a "Thorn Mail" effect to your armors. When an enemy attacks you,
 it will receive a certain amount of damage.
 
 Tag your armors with
    <eff: thorn_mail x>
    
 Where x is the amount of damage they will receive.
#==============================================================================
=end
$imported = {} if $imported.nil?
$imported["Effect_ThornMail"] = true
#==============================================================================
# ** Rest of the script
#==============================================================================
module Effect
  module Thorn_Mail
    Effect_Manager.register_effect(:thorn_mail)
  end
end

class Game_Battler < Game_BattlerBase
  
  def effect_thorn_mail(user, item, effect)
    return if user == self
    damage = eval(effect.value1[0]).to_i
    user.hp -= damage
    user.perform_collapse_effect if user.dead?
    @result.effect_results.push("%s takes %s thorn damage!" %[user.name, damage])
    @result.success = true
  end
  
  alias :state_effect_thorn_mail_guard :effect_thorn_mail
  alias :enemy_effect_thorn_mail_guard :effect_thorn_mail
  alias :actor_effect_thorn_mail_guard :effect_thorn_mail
end

class Game_Actor < Game_Battler
  
  alias :armor_effect_thorn_mail_guard :effect_thorn_mail
  alias :weapon_effect_thorn_mail_guard :effect_thorn_mail
  alias :state_effect_thorn_mail_guard :armor_effect_thorn_mail_guard
end