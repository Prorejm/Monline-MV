=begin
#===============================================================================
 Title: Formula Effects
 Author: Hime
 Date: Feb 6, 2014
 URL: http://himeworks.com/2014/02/06/formula-effects/
--------------------------------------------------------------------------------
 ** Change log
 Feb 6, 2014
   - Initial release
--------------------------------------------------------------------------------   
 ** Terms of Use
 * Free to use in non-commercial projects
 * Contact me for commercial use
 * No real support. The script is provided as-is
 * Will do bug fixes, but no compatibility patches
 * Features may be requested but no guarantees, especially if it is non-trivial
 * Credits to Hime Works in your project
 * Preserve this header
--------------------------------------------------------------------------------
 ** Description
 
 This script allows you to execute arbitrary formulas as an effect.
 
 By default, you have a damage formula that allows you to execute scripts
 within the context of a damage formula object.
 
 Effect formulas are executed within the context of the interpreter, which is
 more useful since many scripts add convenience methods to the interpreter
 (rather than the damage formula).
 
 You have access to a number of references such as the user, the target, and the
 user's current action among other standard formula variables.
 
 This is a stand-alone script and does not rely on my Effects Manager. As
 a result, it does not have all of the functionality that the Effects Manager
 provides.
 
--------------------------------------------------------------------------------
 ** Installation
 
 In the script editor, place this script below Materials and above Main

--------------------------------------------------------------------------------
 ** Usage 

 To create a formula effect, note-tag your item or skill with
 
   <formula effect>
     FORMULA
   </formula effect>
  
 Where the formula can be any valid formula.
 The following formula variables are available
 
   a - user
   b - target
   c - user's action (Game_Action object)
   t - current troop
   p - current party
   s - game switches
   v - game variables
   
 You can access the skill or item that the user is currently using via `c.item`
 
#===============================================================================
=end
$imported = {} if $imported.nil?
$imported[:TH_FormulaEffects] = true
#===============================================================================
# ** Configuration
#===============================================================================
module TH
  module Formula_Effect
    
    @@interpreter = Game_Interpreter.new
    Ext_Regex = /<formula[-_ ]effect>\s*(.*?)\s*<\/formula[-_ ]effect>/im
    
    def self.eval_formula_effect(formula, user, target, action)
      @@interpreter.eval_formula_effect(formula, user, target, action)
    end
  end
end
#===============================================================================
# ** Rest of script
#===============================================================================
module RPG
  class UsableItem < BaseItem
    
    alias :th_formula_effect_effects :effects
    def effects
      load_notetag_formula_effect unless @formula_effect_loaded
      th_formula_effect_effects
    end
    
    def load_notetag_formula_effect
      @formula_effect_loaded = true
      results = self.note.scan(TH::Formula_Effect::Ext_Regex)
      results.each do |res|
        formula = res[0]
        effect = RPG::UsableItem::Effect.new
        effect.code = :formula
        effect.value1 = formula
        @effects.push(effect)
      end
    end
  end
end

class Game_Battler < Game_BattlerBase
  
  alias :th_formula_effect_item_effect_apply :item_effect_apply
  def item_effect_apply(user, item, effect)
    if effect.code == :formula
      item_effect_eval_formula(user, item, effect)
    else
      th_formula_effect_item_effect_apply(user, item, effect)
    end
  end
  
  def item_effect_eval_formula(user, item, effect)
    action = user.current_action
    TH::Formula_Effect.eval_formula_effect(effect.value1, user, self, action)
  end
end

class Game_Interpreter
  
  def eval_formula_effect(formula, a, b, c, p=$game_party, t=$game_troop, s=$game_switches, v=$game_variables)
    eval(formula)
  end
end