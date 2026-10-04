################################################################################
#    Compass script v.1.0.1                                                    #
#         by Tidloc                                                            #
#==============================================================================#
#  simple script, that allows on given maps a compass to appear and point at a #
#  given point on that map. To define that point use th following command:     #
#     Tidloc::Set_Coord(*map*,*x*,*y*)                                         #
#  were x and y are the x and y coordinates on that map.                       #
#  If no coordinates are saved for a specific map, no compass will appear.     #
#==============================================================================#
#  Only adjustable thing in this script is the name of the graphic for the     #
#  compass, and the place where the compass will be shown. Everything else     #
# will be calculated on its own by using the stated command. You can erase the #
# saved coordinates with the command:                                          #
#     Tidloc::Clear_Coord(*map*)                                               #
#  You are free to leave the map out, then all coordinates will be erased.     #
#==============================================================================#
#  Feel free to use this script, but please credit me for my work! ^__^        #
################################################################################

$imported = {} if $imported.nil?
$imported["Tidloc-Compass"] = true


module Tidloc
  module Compass
    Graphic = "compass_needle"
    Target  = "compass_needle"
    X = Graphics.width - 75 #Graphics.width - 32
    Y = 82
  end
 
################################################################################
################################################################################
################################################################################

  class<<self
    def Set_Coord(map,x,y)
      $game_temp._tidloc_compass[map] = [x,y]
    end
    def Clear_Coord(map = nil)
      if map == nil
        $game_temp._tidloc_compass = []
      else
        $game_temp._tidloc_compass[map] = nil
      end
    end
  end
end

class Game_Temp
  attr_accessor :_tidloc_compass
  alias wo_compass_init initialize
  def initialize
    self._tidloc_compass = []
    wo_compass_init
  end
end

class Scene_Map < Scene_Base
  alias wo_compass_update update
  def update
    wo_compass_update
    if $game_temp._tidloc_compass[$game_map.map_id]
      x = Tidloc::Compass::X
      y = Tidloc::Compass::Y
      $game_map.screen.pictures[101].show(Tidloc::Compass::Graphic,
                                           1, x, y, 50, 50, 255, 0)
      xdif = $game_player.x - $game_temp._tidloc_compass[$game_map.map_id][0]
      ydif = $game_player.y - $game_temp._tidloc_compass[$game_map.map_id][1]
      angle = 0
      if    ydif == 0 && xdif > 0
        angle = 180
      elsif ydif == 0 && xdif < 0
        angle = -180
      elsif  xdif == 0 && ydif > 0
        angle = 0
      elsif xdif == 0 && ydif < 0
        angle = 360
      elsif xdif == 0 && ydif == 0
        $game_map.screen.pictures[101].erase
        unless Tidloc::Compass::Target.nil?
          $game_map.screen.pictures[101].show(Tidloc::Compass::Target,
                                           1, x, y, 50, 50, 255, 0)
        end                                   
      else
        angle = Math::atan2(xdif + 0.0, ydif + 0.0) * 360.0 / Math::PI
      end
      $game_map.screen.pictures[101].rotate(angle)
    else
      $game_map.screen.pictures[101].erase
    end
  end
end