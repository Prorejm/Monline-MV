#Animated Icons v1.1
#----------#
#Features: This script let's you set up and use animated icons! Woot!
#
#Usage:   Set up the frames below and set your icons. Animated!
#
#----------#
#-- Script by: V.M of D.T
#
#- Questions or comments can be:
#    posted on the thread for the script
#    given by email: sumptuaryspade@live.ca
#    provided on facebook: http://www.facebook.com/DaimoniousTailsGames
#
#--- Free to use in any project, commercial or non-commercial, with credit given
# - - Though a donation's always a nice way to say thank you~ (I also accept actual thank you's)
 
# Base_index => [icon_index1, icon_index2, icon_index3, ... ],
ANIMATED_ICONS = {
 9202 => [9202, 9202, 9202, 9203, 9203],
}

SIMPLE_REFRESH = true
 
class Window_Base < Window
  alias animicon_init initialize
  alias animicon_update update
  alias animicon_draw_icon draw_icon
  def initialize(*args)
    animicon_init(*args)
    @icon_timer = 0
    @icons = []
  end
  def refresh
  end
  def update(*args)
    animicon_update(*args)
    if contents.refresh_icons
      @icons = []
      contents.refresh_icons = false
    end
    if Graphics.frame_count % 10 == 0
      @icon_timer += 1
      redraw_icons if !@icons.empty? && SIMPLE_REFRESH
      refresh unless SIMPLE_REFRESH
    end
  end
  def draw_icon(icon_index, x, y, enabled = true)
    if !ANIMATED_ICONS.include?(icon_index)
      animicon_draw_icon(icon_index, x, y, enabled)
    else
      @icons.push([icon_index,x,y,enabled])
      index = ANIMATED_ICONS[icon_index][@icon_timer % ANIMATED_ICONS[icon_index].size]
      animicon_draw_icon(index, x, y, enabled)
    end
  end
  def redraw_icons
    @icons.each do |array|
      index = ANIMATED_ICONS[array[0]][@icon_timer % ANIMATED_ICONS[array[0]].size]
      contents.clear_rect(Rect.new(array[1],array[2],24,24))
      animicon_draw_icon(index,array[1],array[2],array[3])
    end
  end
end

class Window_Selectable < Window_Base
  alias anim_draw_all_items draw_all_items
  def draw_all_items
    @icons = []
    anim_draw_all_items
  end
end

class Bitmap
  attr_accessor :refresh_icons
  alias anim_clear clear
  def clear
    anim_clear
    @refresh_icons = true
  end
end