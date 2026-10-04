# ================================================= =============================
# MOG - Weather EX (v2.3)
# ================================================= =============================
# By Moghunter
# Http://www.atelier-rgss.com/
# ================================================= =============================
# Weather with animated effects system.
# ================================================= =============================
# The images used by the climate system must be saved in the folder
#
# GRAPHICS / WEATHER /
#
# ================================================= =============================
# USE
#
# Use the following command through the function call script. * (Event)
#
# Weather (TYPE, POWER, IMAGE_FILE)
#
# TYPE - climate type. (0 to 6)
# POWER - particle count on the screen. (1 to 10)
# IMAGE_FILE - Image Name.
#
# (Eg)
#
# weather(0, 5, "Leaf")
#
# ================================================= =============================
# Climate Types.
#
# The system is pre-configured with 7 climates, it can be tested in Demo
# That comes with this script.
#
# 0 - (Rain)
# 1 - (Wind)
# 2 - (Fog)
# 3 - (Light)
# 4 - (Snow)
# 5 - (Spark)
# 6 - (Random Directions)
#
# ================================================= =============================
# NOTICE
#
# Avoid using too heavy or large images, if you will use
# Diminish the power of weather to avoid lag.
#
# ================================================= =============================
# ================================================= =============================
# To stop the climate use the command.
#
# Weather_stop
# ================================================= =============================
# To stop the climate after the battle use the code below.
#
# Weather_stop_b
#
# ================================================= =============================
# To stop reactivate the climate with caracteríticas used previously use
# Command below.
#
# Weather_restore
# ================================================= =============================
# If you need to turn on a new climate but want to record the caracteríticas
# Of the current climate to be reactivated and then use the code below.
#
# Weather_store
# Weather_restore_store
#
# ================================================= =============================

# ================================================= =============================
# ● History (Version History)
# ================================================= =============================
# V 2.3 - Compatibility with MOG Battle Camera.
# V 2.2 - Added command to stop the climate after the battle.
# V 2.1 - Improved particle position during transitions
# Of scenes.
# V 2.0 - bug correction of random Crash.
#==============================================================================
module MOG_WEATHER_EX
#Prioridade on the screen.
  WEATHER_SCREEN_Z = 50 
#Definition of climate power efficiency.
#NOTE - Too high a value can cause lag, depending on the type of climate and
# Image used.
  WEATHER_POWER_EFIC = 5
#Ativar The mood in the battle system.
  WEATHER_BATTLE = true
end

#==============================================================================
# ■ Cache
#==============================================================================
module Cache
  
  #--------------------------------------------------------------------------
  # ● Weather
  #--------------------------------------------------------------------------
  def self.weather(filename)
      load_bitmap("Graphics/Weather/", filename)
  end
  
end

#==============================================================================
# ■ Game System
#==============================================================================
class Game_System
  
  attr_accessor :weather
  attr_accessor :weather_restore
  attr_accessor :weather_record_set
  attr_accessor :weather_temp
  
  #--------------------------------------------------------------------------
  # ● Initialize
  #--------------------------------------------------------------------------  
  alias weather_ex_initialize initialize  
  def initialize
      @weather = [-1,0,""]
      @weather_restore = [-1,0,""]
      @weather_temp = [-1,0,""]
      @weather_record_set = [-1,0,""]
      weather_ex_initialize 
  end  
  
end  

#==============================================================================
# ■ Game Temp
#==============================================================================
class Game_Temp

  attr_accessor :weather_ex_set
  attr_accessor :weather_fade
  attr_accessor :weather_rf_time
  attr_accessor :weather_fstop
  
  #--------------------------------------------------------------------------
  # ● Initialize
  #--------------------------------------------------------------------------  
  alias mog_weather_ex_temp_initialize initialize
  def initialize
      @weather_ex_set = []
      @weather_fade = false
      @weather_rf_time = 0
      @weather_fstop = false
      mog_weather_ex_temp_initialize
  end  
  
end

#==============================================================================
# ■ Game Interpreter
#==============================================================================
class Game_Interpreter
  
  #--------------------------------------------------------------------------
  # ● Weather
  #--------------------------------------------------------------------------    
  def weather(type = -1, power = 0, image = "")
      $game_temp.weather_fade = false
      $game_temp.weather_rf_time = 0
      $game_system.weather.clear
      $game_system.weather = [type,power,image]
  end
  
  #--------------------------------------------------------------------------
  # ● Weather Stop
  #--------------------------------------------------------------------------     
  def weather_stop
      $game_temp.weather_fade = false
      $game_system.weather.clear
      $game_system.weather = [-1,0,""]
      $game_system.weather_restore  = [-1,0,""]
      $game_system.weather_temp = [-1,0,""]      
  end
  
  #--------------------------------------------------------------------------
  # ● Weather Restore
  #--------------------------------------------------------------------------       
  def weather_restore
      $game_temp.weather_fade = false
      if $game_system.weather[0] != -1
         w = $game_system.weather
         $game_system.weather_restore = [w[0],w[1],w[2]] 
         $game_system.weather.clear
         $game_system.weather = [-1,0,""]
         return
      end
      w = $game_system.weather_restore 
      weather(w[0],w[1],w[2])
  end
  
  #--------------------------------------------------------------------------
  # ● Weather Fade
  #--------------------------------------------------------------------------         
  def weather_fade(value)
      $game_temp.weather_fade = value
  end
  
  #--------------------------------------------------------------------------
  # ● Weather Store
  #--------------------------------------------------------------------------           
  def weather_store
      w = $game_system.weather 
      $game_system.weather_record_set = [w[0],w[1],w[2]]
  end  
  
  #--------------------------------------------------------------------------
  # ● Weather Restore Store
  #--------------------------------------------------------------------------           
  def weather_restore_store
      w = $game_system.weather_record_set
      weather(w[0],w[1],w[2])      
  end    
  
  #--------------------------------------------------------------------------
  # ● Weather Stop B
  #--------------------------------------------------------------------------           
  def weather_stop_b
      $game_temp.weather_fstop = true
  end
  
end  

#==============================================================================
# ** Spriteset_Map
#==============================================================================
class Spriteset_Map
  
  #--------------------------------------------------------------------------
  # * Create Viewport
  #--------------------------------------------------------------------------
  alias mog_weather_ex_create_viewports create_viewports
  def create_viewports
      create_viewport_weather
      mog_weather_ex_create_viewports      
  end
    
  #--------------------------------------------------------------------------
  # * Create Viewport Weather
  #--------------------------------------------------------------------------
  def create_viewport_weather
      return if @viewport_weather != nil
      @viewport_weather = Viewport.new
      @viewport_weather.z = MOG_WEATHER_EX::WEATHER_SCREEN_Z
      @viewport_weather.ox = ($game_map.display_x * 32)
      @viewport_weather.oy = ($game_map.display_y * 32) 
  end
      
  #--------------------------------------------------------------------------
  # * Dispose Viewports
  #--------------------------------------------------------------------------
  alias mog_weather_ex_dispose_viewports dispose_viewports
  def dispose_viewports      
      mog_weather_ex_dispose_viewports
      dispose_viewport_weather
  end
  
  #--------------------------------------------------------------------------
  # * Dispose Viewport Weather
  #--------------------------------------------------------------------------
  def dispose_viewport_weather
      return if @viewport_weather == nil
      @viewport_weather.dispose    
  end
    
  #--------------------------------------------------------------------------
  # * Update Viewports
  #--------------------------------------------------------------------------
  alias mog_weather_ex_update_viewports update_viewports
  def update_viewports
      mog_weather_ex_update_viewports
      update_viewport_weather
  end
  
  #--------------------------------------------------------------------------
  # * Update Viewports Weather
  #--------------------------------------------------------------------------
  def update_viewport_weather
      return if @viewport_weather == nil
      @viewport_weather.ox = ($game_map.display_x * 32) 
      @viewport_weather.oy = ($game_map.display_y * 32)
  end     
  
end

#==============================================================================
# ** Spriteset_Battle
#==============================================================================
class Spriteset_Battle
  
  #--------------------------------------------------------------------------
  # * Create Viewport
  #--------------------------------------------------------------------------
  alias mog_weather_ex_create_viewports_battle create_viewports
  def create_viewports
      mog_weather_ex_create_viewports_battle
      create_viewport_weather    
  end
    
  #--------------------------------------------------------------------------
  # * Create Viewport Weather
  #--------------------------------------------------------------------------
  def create_viewport_weather
      return if @viewport_weather != nil
      @viewport_weather = Viewport.new
      @viewport_weather.z = MOG_WEATHER_EX::WEATHER_SCREEN_Z
  end
    
  #--------------------------------------------------------------------------
  # * Dispose Viewports
  #--------------------------------------------------------------------------
  alias mog_weather_ex_dispose_viewports_battle dispose_viewports
  def dispose_viewports      
      mog_weather_ex_dispose_viewports_battle
      dispose_viewport_weather
  end
  
  #--------------------------------------------------------------------------
  # * Dispose Viewport Weather
  #--------------------------------------------------------------------------
  def dispose_viewport_weather
      return if @viewport_weather == nil
      @viewport_weather.dispose    
  end
    
  #--------------------------------------------------------------------------
  # * Update Viewports
  #--------------------------------------------------------------------------
  alias mog_weather_ex_update_viewports_battle update_viewports
  def update_viewports
      mog_weather_ex_update_viewports_battle
      update_viewport_weather        
  end  
  
  #--------------------------------------------------------------------------
  # * Update Viewports Weather
  #--------------------------------------------------------------------------
  def update_viewport_weather
      return if @viewport_weather == nil
      if $imported[:mog_battle_camera]
         @viewport_weather.ox = $game_temp.viewport_oxy[0]
         @viewport_weather.oy = $game_temp.viewport_oxy[1]
      end   
  end    
  
end

#==============================================================================
# ■ Weather_EX
#==============================================================================
class Weather_EX
  
  #--------------------------------------------------------------------------
  # ● Initialize
  #--------------------------------------------------------------------------  
  def initialize(viewport = nil ,type = 0, image_name = "",index = 0,nx,ny)
      @wp = Sprite.new
      @wp.bitmap = Cache.weather(image_name.to_s)
      @wp.opacity = 0
      @wp.viewport = viewport
      @cw = @wp.bitmap.width
      @cwm = (@cw / 2) + @cw
      @ch = @wp.bitmap.height
      @chm = (@ch / 2) + @ch
      @range_x = [-@cwm,Graphics.width + @cwm]
      @range_y = [-@chm,Graphics.height + @chm]
      @angle_speed = 0
      @x_speed = 0
      @y_speed = 0
      @zoom_speed = 0
      @opacity_speed = 0
      @type = type
      @index = index
      @nx = 0
      @nx_old = 0
      @ny = 0
      @ny_old = 0      
      @old_nx = nx
      @old_ny = ny
      type_setup(nx,ny)
  end
  
  #--------------------------------------------------------------------------
  # ● x
  #--------------------------------------------------------------------------      
  def x
      @wp.x
  end
  
  #--------------------------------------------------------------------------
  # ● y
  #--------------------------------------------------------------------------      
  def y
      @wp.y
  end
  
  #--------------------------------------------------------------------------
  # ● Opacity
  #--------------------------------------------------------------------------      
  def opacity
      @wp.opacity
  end
  
  #--------------------------------------------------------------------------
  # ● Angle
  #--------------------------------------------------------------------------      
  def angle
      @wp.angle
  end
  
  #--------------------------------------------------------------------------
  # ● Zoom X
  #--------------------------------------------------------------------------      
  def zoom_x
      @wp.zoom_x
  end  
  
  #--------------------------------------------------------------------------
  # ● Dispose Weather
  #--------------------------------------------------------------------------      
  def dispose_weather
      return if @wp == nil
      @wp.bitmap.dispose
      @wp.dispose
      @wp = nil
  end
  
  #--------------------------------------------------------------------------
  # ● Pre Values
  #--------------------------------------------------------------------------    
  def pre_values(index)
      return if  $game_temp.weather_ex_set[index] == nil
      @wp.x = $game_temp.weather_ex_set[index][0]
      @wp.y = $game_temp.weather_ex_set[index][1]
      @wp.opacity = 1#$game_temp.weather_ex_set[index][2]
      @wp.angle = $game_temp.weather_ex_set[index][3]
      @wp.zoom_x = $game_temp.weather_ex_set[index][4]
      @wp.zoom_y = $game_temp.weather_ex_set[index][4]
      $game_temp.weather_ex_set[index].clear
      $game_temp.weather_ex_set[index] = nil
  end  
  
  #--------------------------------------------------------------------------
  # ● Type Setup
  #--------------------------------------------------------------------------      
  def type_setup(nx = 0, ny = 0)
      @cw2 = [@range_x[1] + nx, @range_x[0] + nx]
      @ch2 = [@range_y[1] + ny, @range_y[0] + ny]
      check_weather_type
      pre_values(@index)
      @opacity_speed = -1 if $game_temp.weather_fade
  end
  
  #--------------------------------------------------------------------------
  # ● Update
  #--------------------------------------------------------------------------    
  def update_weather(nx = 0, ny = 0)
      @wp.x += @x_speed
      @wp.y += @y_speed
      @wp.opacity += @opacity_speed
      @wp.angle += @angle_speed
      @wp.zoom_x += @zoom_speed
      @wp.zoom_y += @zoom_speed
      check_loop_map(nx,ny)
      type_setup(nx,ny) if can_reset_setup?
  end  

  #--------------------------------------------------------------------------
  # ● Check Loop Map
  #--------------------------------------------------------------------------        
  def check_loop_map(nx,ny)
      if (@old_nx - nx).abs > 32
         @cw2 = [@range_x[1] + nx, @range_x[0] + nx]
         @wp.x += nx
         @wp.x -= @old_nx if nx == 0
      end   
      if (@old_ny - ny).abs > 32
         @ch2 = [@range_y[1] + ny, @range_y[0] + ny]
         @wp.y += ny
         @wp.y -= @old_ny if ny == 0
      end         
      @old_nx = nx
      @old_ny = ny    
  end  
    
  #--------------------------------------------------------------------------
  # ● Can Reset Setup
  #--------------------------------------------------------------------------      
  def can_reset_setup?
      return true if @wp.x > @cw2[0] or @wp.x <  @cw2[1]
      return true if @wp.y > @ch2[0]  or @wp.y < @ch2[1] 
      return true if @wp.opacity == 0
      return true if @wp.zoom_x > 2.0 or @wp.zoom_x < 0.5 
      return false
  end
  
 #--------------------------------------------------------------------------
 # ● Check Weather Type
 #--------------------------------------------------------------------------                         
 def check_weather_type 
     case @type
         when 0;   rain
         when 1;   wind   
         when 2;   fog
         when 3;   light
         when 4;   snow
         when 5;   spark
         when 6;   random                  
      end
 end
    
 #--------------------------------------------------------------------------
 # ● Snow
 #--------------------------------------------------------------------------                          
 def snow
     @wp.angle = rand(360)
     @wp.x = rand(@cw2[0])
     @wp.y = rand(@ch2[0])
     @wp.opacity = 1
     @wp.zoom_x = (rand(100) + 50) / 100.0
     @wp.zoom_y = @wp.zoom_x
     @y_speed = [[rand(5), 1].max, 5].min
     @opacity_speed = 5
     @angle_speed = rand(3)
 end   
 
 #--------------------------------------------------------------------------
 # ● Spark
 #--------------------------------------------------------------------------                           
 def spark
     @wp.angle = rand(360)
     @wp.x = rand(@cw2[0])
     @wp.y = rand(@ch2[0])
     @wp.opacity = 1
     @wp.zoom_x = (rand(100) + 100) / 100.0
     @wp.zoom_y = @wp.zoom_x
     @wp.blend_type = 1     
     @opacity_speed = 10
     @zoom_speed = -0.01
 end
 
 #--------------------------------------------------------------------------
 # ● Rain
 #--------------------------------------------------------------------------                          
 def rain
     @wp.x = rand(@cw2[0])       
     if @start == nil
        @wp.y = rand(@ch2[0]) 
        @start = true
     else
        @wp.y = @ch2[1]        
     end   
     @wp.opacity = 1
     @wp.zoom_y = (rand(50) + 100) / 100.0
     @wp.zoom_x = (rand(25) + 100) / 100.0
     @y_speed = [[rand(10) + 10, 10].max, 20].min
     @opacity_speed = 10
 end    
 
 #--------------------------------------------------------------------------
 # ● Fog
 #--------------------------------------------------------------------------                            
 def fog
     rand_angle = rand(2)
     @wp.angle = rand_angle == 1 ? 180 : 0
     @wp.x = rand(@cw2[0])
     @wp.y = rand(@ch2[0])
     @wp.opacity = 1
     @wp.zoom_x = (rand(100) + 50) / 100.0
     @wp.zoom_y = @wp.zoom_x
     @x_speed = [[rand(10), 1].max, 10].min
     @opacity_speed = 10
 end
 
 #--------------------------------------------------------------------------
 # ● Light
 #--------------------------------------------------------------------------                           
 def light 
     @wp.angle = rand(360)
     @wp.x = rand(@cw2[0])
     @wp.y = rand(@ch2[0])
     @wp.opacity = 1
     @wp.zoom_x = (rand(100) + 50) / 100.0
     @wp.zoom_y = @wp.zoom_x
     @wp.blend_type = 1
     @angle_speed = [[rand(3), 1].max, 3].min
     @y_speed = -[[rand(10), 1].max, 10].min
     @opacity_speed = 2
 end
 
 #--------------------------------------------------------------------------
 # ● Wind
 #--------------------------------------------------------------------------                          
 def wind
     @wp.angle = rand(360)
     @wp.x = rand(@cw2[0])
     @wp.y = rand(@ch2[0])
     @wp.opacity = 1
     @wp.zoom_x = (rand(100) + 50) / 100.0
     @wp.zoom_y = @wp.zoom_x
     @x_speed = [[rand(10), 1].max, 10].min
     @y_speed = [[rand(10), 1].max, 10].min
     @opacity_speed = 10
 end   
      
 #--------------------------------------------------------------------------
 # ● Random
 #--------------------------------------------------------------------------                          
 def random
     @wp.angle = rand(360)
     @wp.x = rand(@cw2[0])
     @wp.y = rand(@ch2[0])
     @wp.opacity = 1
     @wp.zoom_x = (rand(100) + 50) / 100.0
     @wp.zoom_y = @wp.zoom_x
     x_s = [[rand(10), 1].max, 10].min
     y_s = [[rand(10), 1].max, 10].min
     rand_x = rand(2)
     rand_y = rand(2)
     @x_speed = rand_x == 1 ? x_s : -x_s
     @y_speed = rand_y == 1 ? y_s : -y_s      
     @opacity_speed = 10
 end    
 
end

#==============================================================================
# ■ Module Weather EX
#==============================================================================
module Module_Weather_EX
  
 #--------------------------------------------------------------------------
 # ● Create Weather EX
 #--------------------------------------------------------------------------                   
  def create_weather_ex
      dispose_weather_ex
      create_weather_sprite     
  end
  
 #--------------------------------------------------------------------------
 # ● Dispose Wheater EX
 #--------------------------------------------------------------------------                     
  def dispose_weather_ex
      dispose_weather_ex_sprite
  end
 
 #--------------------------------------------------------------------------
 # ● Create Weather Sprite
 #--------------------------------------------------------------------------                       
  def create_weather_sprite
      dispose_weather_ex_sprite
      @old_weather = $game_system.weather
      return if $game_system.weather == [] or $game_system.weather[0] == -1
      @weather_ex = []
      @weather_oxy = [$game_map.display_x * 32,
                      $game_map.display_y * 32]      
      index = 0
      power_efic = MOG_WEATHER_EX::WEATHER_POWER_EFIC
      power_efic = 1 if power_efic < 1
      power = [[$game_system.weather[1] * power_efic, power_efic].max, 999].min
      for i in 0...power
          @weather_ex.push(Weather_EX.new(@viewport_weather,$game_system.weather[0],$game_system.weather[2],index, @viewport1.ox, @viewport1.oy))
          index += 1
      end            
  end
  
 #--------------------------------------------------------------------------
 # ● Dispose Weather EX
 #--------------------------------------------------------------------------                   
  def dispose_weather_ex_sprite
      return if @weather_ex == nil
      index = 0
      for i in @weather_ex
          $game_temp.weather_ex_set[index] = [] if $game_temp.weather_ex_set[index] == nil
          $game_temp.weather_ex_set[index].push(i.x,i.y,i.opacity,i.angle,i.zoom_x)
          i.dispose_weather
          index += 1
      end
      @weather_ex.each {|sprite| sprite.dispose_weather}  
      @weather_ex = nil
  end
  
 #--------------------------------------------------------------------------
 # ● Dispose Refresh
 #--------------------------------------------------------------------------                    
  def dispose_refresh
      $game_temp.weather_ex_set.clear
      return if @weather_ex == nil
      @weather_ex.each {|sprite| sprite.dispose_weather}
      @weather_ex = nil
  end  
  
 #--------------------------------------------------------------------------
 # ● Update Weather EX
 #--------------------------------------------------------------------------                   
  def update_weather_ex
      $game_temp.weather_rf_time -= 1 if $game_temp.weather_rf_time > 0
      refresh_weather_ex if $game_temp.weather_rf_time == 0
      return if @weather_ex == nil
      @weather_ex.each {|sprite| sprite.update_weather(@viewport_weather.ox,@viewport_weather.oy)} 
  end
  
 #--------------------------------------------------------------------------
 # ● Refresh Weather EX
 #--------------------------------------------------------------------------                     
  def refresh_weather_ex
      return if @old_weather == nil
      return if @old_weather == $game_system.weather
      dispose_refresh      
      create_weather_sprite
  end  
    
end  

#==============================================================================
# ■ Spriteset Map
#==============================================================================
class Spriteset_Map
   include Module_Weather_EX  
   
 #--------------------------------------------------------------------------
 # ● Initialize
 #--------------------------------------------------------------------------                   
  alias mog_weather_ex_initialize initialize
  def initialize
      dispose_weather_ex    
      mog_weather_ex_initialize
      create_weather_ex
  end

 #--------------------------------------------------------------------------
 # ● Dispose
 #--------------------------------------------------------------------------                   
  alias mog_weather_ex_dispose dispose
  def dispose
      dispose_weather_ex    
      mog_weather_ex_dispose
  end  

 #--------------------------------------------------------------------------
 # ● Update
 #--------------------------------------------------------------------------                   
  alias mog_weather_ex_update update
  def update
      mog_weather_ex_update
      update_weather_ex
  end  
    
end

if MOG_WEATHER_EX::WEATHER_BATTLE 
#==============================================================================
# ■ Spriteset Battle
#==============================================================================
class Spriteset_Battle
  
   include Module_Weather_EX  
   
 #--------------------------------------------------------------------------
 # ● Initialize
 #--------------------------------------------------------------------------                   
  alias mog_weather_ex_initialize initialize
  def initialize
      dispose_weather_ex    
      mog_weather_ex_initialize
      create_weather_ex
  end

 #--------------------------------------------------------------------------
 # ● Dispose
 #--------------------------------------------------------------------------                   
  alias mog_weather_ex_dispose dispose
  def dispose
      mog_weather_ex_dispose
      dispose_weather_ex 
  end  

 #--------------------------------------------------------------------------
 # ● Update
 #--------------------------------------------------------------------------                   
  alias mog_weather_ex_update update
  def update
      mog_weather_ex_update
      update_weather_ex
  end   
    
end

end

#=============================================================================
# ■ Scene Base
#=============================================================================
class Scene_Base
  
  #--------------------------------------------------------------------------
  # ● Weather Recover Data
  #--------------------------------------------------------------------------  
  def weather_recover_data
      if $game_system.weather.empty? or 
          $game_system.weather[0] == -1 
          if !$game_system.weather_restore.empty? and 
             $game_system.weather_restore[0] != -1
             v = $game_system.weather_restore
             $game_system.weather = [v[0],v[1],v[2]]
          end
      end         
  end
  
  #--------------------------------------------------------------------------
  # ● Weather Restore
  #--------------------------------------------------------------------------       
  def weather_recover_scene
      return if $game_system.weather_temp.empty?
      return if $game_system.weather_temp[0] == -1
      w = $game_system.weather_temp
      $game_system.weather = [w[0],w[1],w[2]]
      $game_system.weather_temp.clear
      $game_system.weather_temp = [-1,0,""]
  end  
 
  #--------------------------------------------------------------------------
  # ● Main
  #--------------------------------------------------------------------------         
  alias mog_weather_ex_main main
  def main
      dispose_weather_ex_base
      weather_recover_scene if can_recover_weather_scene?
      mog_weather_ex_main
  end    
  
  #--------------------------------------------------------------------------
  # ● Can Recover Weather Scene
  #--------------------------------------------------------------------------         
  def can_recover_weather_scene?
      return true if SceneManager.scene_is?(Scene_Map)
      return true if SceneManager.scene_is?(Scene_Battle)
      return false
  end  
  
  #--------------------------------------------------------------------------
  # ● terminate
  #--------------------------------------------------------------------------         
  alias mog_weather_ex_terminate_base terminate
  def terminate
      mog_weather_ex_terminate_base
      dispose_weather_ex_base      
  end  

  #--------------------------------------------------------------------------
  # ● Dispose Weather EX Base
  #--------------------------------------------------------------------------           
  def dispose_weather_ex_base
      return if @spriteset == nil
      @spriteset.dispose_weather_ex rescue nil
  end        
  
end

#=============================================================================
# ■ Sprite Battle
#=============================================================================
class Spriteset_Battle  

  #--------------------------------------------------------------------------
  # ● Dispose
  #--------------------------------------------------------------------------           
  alias mog_weather_ex_aft_dispose dispose
  def dispose
      force_stop_weather_ex_after_battle
      mog_weather_ex_aft_dispose
  end

  #--------------------------------------------------------------------------
  # ● Force Stop Weather EX After
  #--------------------------------------------------------------------------           
  def force_stop_weather_ex_after_battle
      return if !$game_temp.weather_fstop
      $game_temp.weather_fstop = false
      $game_temp.weather_fade = false
      $game_system.weather.clear
      $game_system.weather = [-1,0,""]
      $game_system.weather_restore  = [-1,0,""]
      $game_system.weather_temp = [-1,0,""]       
  end
    
  
end

#=============================================================================
# ■ Scene Load
#=============================================================================
class Scene_Load < Scene_File
  
  #--------------------------------------------------------------------------
  # ● On Load Success
  #--------------------------------------------------------------------------
  alias mog_weather_ex_on_load_success on_load_success
  def on_load_success
      mog_weather_ex_on_load_success
      weather_recover_data
  end
end

#=============================================================================
# ■ Scene Manager
#=============================================================================
class << SceneManager
  
  #--------------------------------------------------------------------------
  # ● Call
  #--------------------------------------------------------------------------         
  alias mog_weather_ex_call call
  def call(scene_class)
      weather_dispose
      mog_weather_ex_call(scene_class)
  end
  
  #--------------------------------------------------------------------------
  # ● Weather Restore
  #--------------------------------------------------------------------------       
  def weather_dispose
      return if $game_system.weather.empty?
      return if $game_system.weather[0] == -1
      w = $game_system.weather
      $game_system.weather_temp = [w[0],w[1],w[2]]
      $game_system.weather.clear
      $game_system.weather = [-1,0,""]
  end    
  
end