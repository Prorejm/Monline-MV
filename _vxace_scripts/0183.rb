#===============================================================================
#
# Enemy Summon Skill (1.0)
# 30/1/12
# By modern algebra and (ported to VXA) Pacman
# This script allows you to make skills for enemies where they can summon or
# call additional enemies to the battlefield. This is NOT a summon skill that
# can be used by actors - it can ONLY be used by enemies.
# You can set up some basic configuration at line 44. Please check the comments
# to see what each option does.
# To create a summoning skill (which can only be used by enemies), simply put
# the following code in the skill's notebox:
#
# \SUMMON_ENEMY[id, x, y, n]
#
#   id : the ID of the enemy it can summon.
#   x  : the additional pixels along the axis the summoned creature is from
#       its summoner. If omitted, it defaults to the value at line 64.
#   y  : the additional pixels along the axis the summoned creature is from
#       its summoner. If omitted, it defaults to the value at line 67.
#   n  : of the potential candidates for summoning, how likely this one
#       will be chosen over the others. If omitted, this defaults to 1.
#
# As you can probably tell, you can place a number of these codes in the
# same notebox and thus you can make the same skill potentially summon
# different enemies, and you can control that through the chance.
#
#  EXAMPLES:
#
#    A skill with its notebox set up like this:
#      \summon_enemy[1, 35, 45, 3]
#      \summon_enemy[2, 25, 35, 1]
#
# Would, when it succeeds (which is governed directly by the hit ratio of the
# skill) summon the enemy with ID 1 (Default: Slime) 75% of the time and the
# enemy with ID 2 (Default: Bat) 25% of the time, and the position, if it is
# a slime would be 35 pixels to the right of the summoner and 45 pixels down,
# or if it is the bat, then 25 pixels to the right of the summoner and 35
# pixels down. The chances are 75-25 because 3 + 1 = 4, which means that 3/4
# times the slime will be summoned and 1/4 times the bat will be summoned.
#
#=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です==
#
# CONFIGURATION
#
module MA_ESS # Don't touch this.
  SUMMON_FAILURE = "%s failed to summon!" # Message shown when skill fails.
  MAX_TROOP_SIZE = 4  # Maximum number of enemies in a troop (caps summons)
  DEFAULT_X_PLUS = 35 # The default x offset for a summoned enemy from its
                      # summoner. If you manually set this in the note box,
                      # this value will not be used.
  DEFAULT_Y_PLUS = 0 # The default y offset for a summoned enemy from its
                      # summoner. If you manually set this in the note box,
                      # this value will not be used.
end           # Don't touch this either.
#
# END CONFIGURATION
#
#=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です==
 
#==============================================================================
# ** RPG::Skill
#------------------------------------------------------------------------------
# 　Data class for skills. Subclass of RPG::UsableItem. Some Japanese twaddle.
#==============================================================================
 
class RPG::Skill < RPG::UsableItem
  #--------------------------------------------------------------------------
  # * 味方のスキルを呼んでいるのか？
  #--------------------------------------------------------------------------
  def ma_call_ally?
    self.note[/\\SUMMON[_ ]?ENEMY\[\d+.*?\]/i] != nil
  end
  #--------------------------------------------------------------------------
  # * 同盟国統計情報を呼び出す
  #--------------------------------------------------------------------------
  def ma_call_ally
    miss = rand(100)
    return nil if self.success_rate < miss
    possibilities = []
    note = self.note.dup
    note.gsub!(/\\SUMMON[_ ]?ENEMY\[(\d+)[,;]?\s*(-?\d*)[,;]?\s*(-?\d*)[,;]?\s*(\d*)\]/i) { |match|
      i = $1.to_i
      x = $2.empty? ? MA_ESS::DEFAULT_X_PLUS : $2.to_i
      y = $3.empty? ? MA_ESS::DEFAULT_Y_PLUS : $3.to_i
      n = $4.empty? ? 1 : $4.to_i
      (n).times do possibilities.push([i, x, y]) end
      ""
    }
    return *possibilities[rand(possibilities.size)]
  end
end
 
#==============================================================================
# ** Game_Enemy
#------------------------------------------------------------------------------
# 　見て、いずれにしてもこれを読んでするつもりはない、ので、私は基本的に私が好きなこの発言を行うことができます。
#==============================================================================
 
class Game_Enemy < Game_Battler
  #--------------------------------------------------------------------------
  # 公開インスタンス変数
  #--------------------------------------------------------------------------
  attr_accessor :ma_summon_count
  #--------------------------------------------------------------------------
  # * オブジェクトの初期化
  #--------------------------------------------------------------------------
  alias maess_initialize initialize
  def initialize(*args)
    @ma_summon_count = 0
    maess_initialize(*args)
  end
end
 
#==============================================================================
# ** Game_BattlerBase
#------------------------------------------------------------------------------
# 　私は本当にエンターブレインが同時に、英語版と日本語版をリリースしたところは思った。
#==============================================================================
 
class Game_BattlerBase
  #--------------------------------------------------------------------------
  # エイリアスのリスト
  #--------------------------------------------------------------------------
  alias maess_sklconditionsmet? skill_conditions_met?
  #--------------------------------------------------------------------------
  # * スキルの条件が満たさ？
  #--------------------------------------------------------------------------
  def skill_conditions_met?(skill, *args)
    return false if skill.ma_call_ally? && (self.is_a?(Game_Actor) ||
    $game_troop.members.size >= MA_ESS::MAX_TROOP_SIZE)
    maess_sklconditionsmet?(skill, *args)
  end
end
 
#==============================================================================
# ** Game_Troop
#------------------------------------------------------------------------------
# 　戦闘シーンのクラスはすべての場所を超えているため、このスクリプトでは、予想よりもはるかに困難だった。
#==============================================================================
 
class Game_Troop < Game_Unit
  #--------------------------------------------------------------------------
  # * コールの味方のスキル
  #--------------------------------------------------------------------------
  def ma_call_ally(user, id, x, y)
    user.ma_summon_count += 1
    enemy = Game_Enemy.new(@enemies.size, id)
    good_position = false
    while !good_position
      enemy.screen_x = user.screen_x + (x * user.ma_summon_count)
      enemy.screen_y = user.screen_y + (y * user.ma_summon_count)
      good_position = true
      @enemies.each { |baddie|
        if baddie.screen_x == enemy.screen_x && baddie.screen_y == enemy.screen_y
          user.ma_summon_count += 1
          good_position = false
        end
      }
    end
    @enemies.push(enemy)
    make_unique_names
    return enemy
  end
end
 
#==============================================================================
# ** Spriteset_Battle
#------------------------------------------------------------------------------
# 　この水は実際に青であることをご存知ですか？
#==============================================================================
 
class Spriteset_Battle
  #--------------------------------------------------------------------------
  # * コールの敵のスキル
  #--------------------------------------------------------------------------
  def ma_call_enemy(battler)
    @enemy_sprites.push(Sprite_Battler.new(@viewport1, battler))
  end
end
 
#==============================================================================
# ** Scene_Battle
#------------------------------------------------------------------------------
# 　彼らはこの1つを作ったとき、私はエンターブレインのプログラマーたちが、考えていたのか見当がつかない。
# レッツだけでこの作品を願って、えっ？
#==============================================================================
 
class Scene_Battle < Scene_Base
  #--------------------------------------------------------------------------
  # エイリアスのリスト
  #--------------------------------------------------------------------------
  alias maess_use_item use_item
  #--------------------------------------------------------------------------
  # * アイテムを使用してください
  #--------------------------------------------------------------------------
  def use_item(*args)
    item = @subject.current_action.item
    if item.is_a?(RPG::Skill)
      skill = item
      if skill.ma_call_ally?
        id, x, y = skill.ma_call_ally
        if id.nil?
          text = sprintf(MAESS::SUMMON_FAILURE, @subject.name)
          @log_window.add_text(text)
          wait(30)
          return
        else
          target = $game_troop.ma_call_ally(@subject, id, x, y)
          @spriteset.ma_call_enemy(target)
          show_animation([target], skill.animation_id)
        end
      end
    end
    maess_use_item(*args)
  end
end
 
$imported ||= {}
$imported[:pac_maess]
 
#===============================================================================
#
# スクリプトの最後
# それは、このスクリプトは日本語で書かれていることに思えるかもしれません。
# しかし、実際に、私はちょうど退屈し、すべてのコメントを翻訳しまった。
# 悪い。
#
#=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です=です==