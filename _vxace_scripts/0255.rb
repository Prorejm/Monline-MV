# *****************************************************************************
#
# OC BATTLE CAMERA
# Author: Ocedic, KMS
# Site: http://ocedic.wordpress.com/
# Version: 1.7
# Last Updated: 3/27/13
#
# Updates:
# 1.7 - Fixed a crash when escaping
# 1.6 - Added a sprite move variance confirguation which let's you decrease the
#       amount of sprite movement during camera movements
# 1.5 - In SBSs, camera will now focus on party members when targeting them with
#       friendly spells or items
# 1.4 - Enemy sprite zoom can now enabled and disabled, sprite y control now
#       affects both enemies and actors
# 1.3 - Resolution support is now automatic, added compatibility with Victor 
#       Animated Battlers and generic SBS support
# 1.2 - Added new configuration settings
# 1.1 - Removed some extraneous code, sprites now move based on camera target
# 1.0 - First release
#
# *****************************************************************************

$imported = {} if $imported.nil?

#==============================================================================
# ? Introduction
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# This is an adaptation of KGC's Motion Battle Camera, which adds a moving
# camera that follows the flow of battle. I used a lot of code by KGC, but
# made my own modifications to get it working in Ace.
#==============================================================================
# ? Instructions
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# Plug and play script. Simply paste it above Main. Settings can be adjusted
# in configuration section.
#==============================================================================
# ? Compatibility
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# This script works with YEA Battle System and Victor's Animated Battlers. It
# also works with Jet's Viewed Battle System and Symphony, but you'll have to 
# enable the SIDEVIEW_SYSTEM switch in configuration. Note that Symphony must
# disable shadows to work at the moment.
# Other SBSs may work depending on their implementation, just enable the switch
# and try.
# Just make sure that it's placed below them.
#==============================================================================
# ? Terms of Use
# =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
# Free for non-commercial use. Credit must be given to both Ocedic and KMS.
# This script is not for commercial use.
#==============================================================================

#==============================================================================
# ¦ Configuration
#------------------------------------------------------------------------------
#  Change customizable settings here
#==============================================================================
module OC
  module OBC

#==============================================================================
# * Enemy Sprite Zoom *
#------------------------------------------------------------------------------
#   Controls whether enemy sprites are zoomed. When enabled, enemies are zoomed
#   out the higher their Y-axis, creating a pseudo-3D effect. Set this to false
#   to disable to behavior.
#==============================================================================
# * Sprite Move Variance *
#------------------------------------------------------------------------------
#   This controls how much sprites move. Higher numbers mean less movement. In
#   certain SBSs it may look better to set this to 2. Do not set it to zero.
#==============================================================================
# * Camera Move Speed *
#------------------------------------------------------------------------------
#   Adjusts the camera speed, higher value is faster
#============================================================================== 
    ENEMY_SPRITE_ZOOM = true
    SPRITE_MOVE_VARIANCE = 8
    CAMERA_SPEED_INIT = 14
    
#==============================================================================
# * Sideview Battle System *
#------------------------------------------------------------------------------
#   Currently, only a handful of sideview battle systems are supported (see 
#   above.) If you're using a supported SBS, it should work automatically. If 
#   you're using a different SBS, try setting this to true and it may work 
#   depending on how the system is implemented.
#==============================================================================
# * Sideview: Move Actor Sprite Y-Axis *
#------------------------------------------------------------------------------
#   When using a SBS, choose whether to move the actor's sprite along the Y-axis
#   relative to the camera. Set it to false if you wish to disable this behavior
#   which may look weird on some systems like Jet's Viewed Battle.
#==============================================================================
    SIDEVIEW_SYSTEM = false
    SBS_SPRITE_Y = true
  
  end
end

#==============================================================================
# ¦ Game_Enemy 
#==============================================================================

class Game_Enemy < Game_Battler
#==============================================================================
# * Accessors *
#==============================================================================
  attr_accessor :origin_x, :origin_y
  
#==============================================================================
# * Alias: Initialize *
#==============================================================================
  alias oc_game_enemy_initialize_naslo initialize
  def initialize(index, enemy_id)
    oc_game_enemy_initialize_naslo(index, enemy_id)
    @origin_x = 0
    @origin_y = 0
  end 

#==============================================================================
# * New Def: Zoom *
#------------------------------------------------------------------------------
#  Returns the magnification ratio
#==============================================================================
  def zoom
      n = (1.00 + SceneManager.scene.camera.z / 512.00) * ((@origin_y - 304) / 256.00 + 1)
    return n
  end

end #class game_enemy

#==============================================================================
# ¦ Game_Actor
#==============================================================================

class Game_Actor < Game_Battler
  
#==============================================================================
# * Accessors *
#==============================================================================
  attr_accessor :origin_x, :origin_y
  
  alias oc_game_actor_initialize_23kls initialize
  def initialize(actor_id)
    oc_game_actor_initialize_23kls(actor_id)
    @origin_x = 0
    @origin_y = 0
  end  
  
end #class game_actor  

#==============================================================================
# ¦ Game_Troop 
#==============================================================================

class Game_Troop < Game_Unit

#==============================================================================
# * Overwrite: Setup *
#==============================================================================
  def setup(troop_id)
    clear
    @troop_id = troop_id
    @enemies = []
    troop.members.each do |member|
      next unless $data_enemies[member.enemy_id]
      enemy = Game_Enemy.new(@enemies.size, member.enemy_id)
      enemy.hide if member.hidden
      enemy.screen_x = enemy.origin_x = member.x + (Graphics.width - 544) / 2
      enemy.screen_y = enemy.origin_y = member.y + (Graphics.height - 416)
      @enemies.push(enemy)
    end
    init_screen_tone
    make_unique_names
  end
  
end #class game_troop

#==============================================================================
# ** Sprite_Battler **
#------------------------------------------------------------------------------
#  This sprite is used to display battlers. It observes an instance of the
# Game_Battler class and automatically changes sprite states.
#==============================================================================
class Sprite_Battler < Sprite_Base

#==============================================================================
# * Alias: Update *
#==============================================================================  
  alias oc_sprite_battler_update_sfdkl update
  def update
    oc_sprite_battler_update_sfdkl

    return if @battler == nil || !@battler.is_a?(Game_Enemy) || !SceneManager.scene_is?(Scene_Battle)
    self.zoom_x = self.zoom_y = @battler.zoom if OC::OBC::ENEMY_SPRITE_ZOOM
  end
  
end #class sprite_battler

#==============================================================================
# ¦ Spriteset_Battle 
#==============================================================================

class Spriteset_Battle
  
#==============================================================================
# * Alias: Update *
#==============================================================================  
  alias oc_spriteset_battle_update_pkwer update
  def update
    oc_spriteset_battle_update_pkwer
    return if !SceneManager.scene_is?(Scene_Battle)
    
    cx, cy, cz = SceneManager.scene.camera.x, SceneManager.scene.camera.y, SceneManager.scene.camera.z
    bx, by = @back2_sprite.x + Graphics.width / 2, @back2_sprite.y + 304
    if bx != cx || by != cy || @bz != cz
      # Adjust zoom
      if Graphics.width > 544 && Graphics.height > 416
        zoom = cz / 1024.00 + 1
      else
        zoom = cz / 416.00 + 1
      end
      @back1_sprite.zoom_x = @back2_sprite.zoom_x = zoom * 2.0
      @back1_sprite.zoom_y = @back2_sprite.zoom_y = zoom * 2.0
      
      # Adjust coordinates
      @back1_sprite.x = -cx * zoom / 2 - Graphics.width / 2 + @back1_sprite.ox * 2
      @back1_sprite.y = -cy * zoom / 2 - Graphics.height / 3 + @back1_sprite.oy * 2
      @back2_sprite.x = -cx * zoom / 2 - Graphics.width / 2 + @back2_sprite.ox * 2
      @back2_sprite.y = -cy * zoom / 2 - Graphics.height / 3 + @back2_sprite.oy * 2
      @bz = cz
    end
    
    # Adjusts sprites' coordinates based on position relative to camera
    if OC::OBC::ENEMY_SPRITE_ZOOM
      @enemy_sprites.each { |e| e.x -= SceneManager.scene.camera.x * e.battler.zoom / OC::OBC::SPRITE_MOVE_VARIANCE}
      @enemy_sprites.each { |e| e.y -= SceneManager.scene.camera.y * e.battler.zoom / OC::OBC::SPRITE_MOVE_VARIANCE} if OC::OBC::SBS_SPRITE_Y
    else
      @enemy_sprites.each { |e| e.x -= SceneManager.scene.camera.x / OC::OBC::SPRITE_MOVE_VARIANCE}
      @enemy_sprites.each { |e| e.y -= SceneManager.scene.camera.y / OC::OBC::SPRITE_MOVE_VARIANCE} if OC::OBC::SBS_SPRITE_Y
    end
    if $imported[:ve_actor_battlers] || OC::OBC::SIDEVIEW_SYSTEM
      @actor_sprites.each { |e| e.x -= SceneManager.scene.camera.x / OC::OBC::SPRITE_MOVE_VARIANCE}
      @actor_sprites.each { |e| e.y -= SceneManager.scene.camera.y / OC::OBC::SPRITE_MOVE_VARIANCE} if OC::OBC::SBS_SPRITE_Y
    end
  end
  
end #class spriteset_battle

#==============================================================================
# ¦ New Class: Camera 
#------------------------------------------------------------------------------
#  Handles the movable battle camera
#==============================================================================

class Camera
  
#==============================================================================
# * Accessors *
#==============================================================================
  attr_reader :x, :y, :z
  attr_accessor :camera_speed

#==============================================================================
# * Initialize *
#==============================================================================
  def initialize
    @x, @y, @z = 0, 0, 0
    @camera_speed = OC::OBC::CAMERA_SPEED_INIT
    @move_x, @move_y, @move_z = 0, 0, 0
  end

#==============================================================================
# * Move *
#------------------------------------------------------------------------------
#  Repositions the battle camera
#==============================================================================
  def move(x, y, z)
    @move_x = x - @x - Graphics.width / 2
    @move_y = y - @y - Graphics.height / 3
    @move_z = z - @z
  end

#==============================================================================
# * Move_Target *
#------------------------------------------------------------------------------
#  Positions the camera to focus on an enemy
#==============================================================================
  def move_target(target)
    return if target == nil && !target.is_a?(Game_Enemy)
    target_x = target.origin_x
    target_y = target.origin_y - 144
    target_z = (304 - target.origin_y) * 4
    move(target_x, target_y, target_z)
  end

#==============================================================================
# * Move_Center *
#------------------------------------------------------------------------------
#  Positions the camera to the center
#==============================================================================
  def move_center
    @move_x = -@x
    @move_y = -@y
    @move_z = -@z
  end

#==============================================================================
# * Update *
#==============================================================================
  def update
    # X-coordinate movement
    mv = [[@move_x.abs * @camera_speed / 160, 1].max, @camera_speed].min
    if @move_x > 0
      @x += mv
      @move_x = [@move_x - mv, 0].max
    elsif @move_x < 0
      @x -= mv
      @move_x = [@move_x + mv, 0].min
    end
    
    # Y-coordinate movement
    mv = [[@move_y.abs * @camera_speed / 160, 1].max, @camera_speed].min
    if @move_y > 0
      @y += mv
      @move_y = [@move_y - mv, 0].max
    elsif @move_y < 0
      @y -= mv
      @move_y = [@move_y + mv, 0].min
    end
    
    # Z-coordinate movement
    mv = [[@move_z.abs * @camera_speed / 96, 1].max, @camera_speed * 2].min
    if @move_z > 0
      @z += mv
      @move_z = [@move_z - mv, 0].max
    elsif @move_z < 0
      @z -= mv
      @move_z = [@move_z + mv, 0].min
    end
  end
  
end #class camera

#==============================================================================
# ¦ BattleManager
#==============================================================================

class << BattleManager
  
  #--------------------------------------------------------------------------
  # * Alias method: init_members
  #--------------------------------------------------------------------------
  alias oc_battlemanager_init_members_9jsla init_members
  def init_members
    oc_battlemanager_init_members_9jsla
    if $imported[:ve_actor_battlers] || OC::OBC::SIDEVIEW_SYSTEM
      $game_party.members.each do |member|
        member.origin_x = member.screen_x
        member.origin_y = member.screen_y
      end
    end
  end  
  
end #class battlemanager

#==============================================================================
# ¦ Window BattleActor
#==============================================================================
class Window_BattleActor < Window_BattleStatus
  
#==============================================================================
# * New Def: Ally *
#------------------------------------------------------------------------------
#  Returns the magnification ratio
#==============================================================================
  def ally
    $game_party.alive_members[@index]
  end  
  
end #class window_battleactor

#==============================================================================
# ¦ Scene_Battle 
#==============================================================================

class Scene_Battle < Scene_Base

#==============================================================================
# * Accessors *
#==============================================================================
  attr_reader :camera
  
#==============================================================================
# * Alias: Start *
#==============================================================================
  alias oc_scene_battle_start_ojmwe start
  def start
    @camera = Camera.new
    oc_scene_battle_start_ojmwe
  end
  
#==============================================================================
# * Alias: Update_Basic *
#==============================================================================
  
  alias oc_scene_battle_update_m32ls update_basic
  def update_basic
    @camera.update
    oc_scene_battle_update_m32ls
    
    if @subject.is_a?(Game_Enemy) && $imported[:ve_actor_battlers] == nil && OC::OBC::SIDEVIEW_SYSTEM == false
      # If the target is an enemy, camera will zoom on it
      @camera.move_target(@subject)
    else
      # If enemy selection window is up, camera will zoom on target
      return if @enemy_window.nil?
      if @enemy_window.active
        if $imported["YEA-BattleEngine"]
          if @enemy_window.select_all?
            @camera.move_center
          else
            @camera.move_target(@enemy_window.enemy)
          end
        else
          @camera.move_target(@enemy_window.enemy)
        end
      else
        if ($imported[:ve_actor_battlers] || OC::OBC::SIDEVIEW_SYSTEM == true) && !@actor_window.nil? && @actor_window.active
          @camera.move_target(@actor_window.ally)
        else
          # If enemy selection window is not up, camera will zoom out
          @camera.move(Graphics.width / 2, Graphics.height / 3, -48)
        end
      end
    end
  end
  
end #class scene_battle