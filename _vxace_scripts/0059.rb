#==============================================================================
# ** Window_EquipStatus
#------------------------------------------------------------------------------
#  This window displays actor parameter changes on the equipment screen.
#==============================================================================

class Window_EquipStatus < Window_Base
  #--------------------------------------------------------------------------
  # * Object Initialization
  #--------------------------------------------------------------------------
  def initialize(x, y)
    super(x, y, window_width, window_height)
    @actor = nil
    @temp_actor = nil
    refresh
  end
  #--------------------------------------------------------------------------
  # * Get Window Width
  #--------------------------------------------------------------------------
  def window_width
    return 208
  end
  #--------------------------------------------------------------------------
  # * Get Window Height
  #--------------------------------------------------------------------------
  def window_height
    fitting_height(visible_line_number)
  end
  #--------------------------------------------------------------------------
  # * Get Number of Lines to Show
  #--------------------------------------------------------------------------
  def visible_line_number
    return 7
  end
  #--------------------------------------------------------------------------
  # * Set Actor
  #--------------------------------------------------------------------------
  def actor=(actor)
    return if @actor == actor
    @actor = actor
    refresh
  end
  #--------------------------------------------------------------------------
  # * Refresh
  #--------------------------------------------------------------------------
  def refresh
    contents.clear
    draw_actor_name(@actor, 4, 0) if @actor
    6.times {|i| draw_item(0, line_height * (1 + i), 2 + i) }
  end
  #--------------------------------------------------------------------------
  # * Set Temporary Actor After Equipment Change
  #--------------------------------------------------------------------------
  def set_temp_actor(temp_actor)
    return if @temp_actor == temp_actor
    @temp_actor = temp_actor
    refresh
  end
  #--------------------------------------------------------------------------
  # * Draw Item
  #--------------------------------------------------------------------------
  def draw_item(x, y, param_id)
    draw_param_name(x + 4, y, param_id)
    draw_current_param(x + 94, y, param_id) if @actor
    draw_right_arrow(x + 126, y)
    draw_new_param(x + 150, y, param_id) if @temp_actor
  end
  #--------------------------------------------------------------------------
  # * Draw Parameter Name
  #--------------------------------------------------------------------------
  def draw_param_name(x, y, param_id)
    if @actor.class.name == "Terminal" #PXE "Error" Status
      cran = 18 #set colour to red
      change_color(text_color(cran))
      xran = rand(10) #x location randomised
      yran = rand(5) #y location randomised
      textran = "or" * rand(8) #random extentions to text
      draw_text(xran + x, yran + y, 80, line_height, "sys#err" + textran)
    else
      change_color(system_color)
      draw_text(x, y, 80, line_height, Vocab::param(param_id))
    end
  end
  #--------------------------------------------------------------------------
  # * Draw Current Parameter
  #--------------------------------------------------------------------------
  def draw_current_param(x, y, param_id)
    if @actor.class.name == "Terminal" #PXE "Error" Status
      cran = 18
      change_color(text_color(cran))
      xran = rand(10)
      yran = rand(5)
      ranum = rand(1000)
      draw_text(xran + x, yran + y, 32, line_height, ranum, 2)
    else
      change_color(normal_color)
      draw_text(x, y, 32, line_height, @actor.param(param_id), 2)
    end
  end
  #--------------------------------------------------------------------------
  # * Draw Right Arrow
  #--------------------------------------------------------------------------
  def draw_right_arrow(x, y)
    if @actor.class.name == "Terminal" #PXE "Error" Status
      cran = 18
      change_color(text_color(cran))
      xran = rand(5)
      yran = rand(5)
      draw_text(xran + x, yran + y, 22, line_height, "→", 1)
    else
      change_color(system_color)
      draw_text(x, y, 22, line_height, "→", 1)
    end
  end
  #--------------------------------------------------------------------------
  # * Draw Post-Equipment Change Parameter
  #--------------------------------------------------------------------------
  def draw_new_param(x, y, param_id)
    new_value = @temp_actor.param(param_id)
    change_color(param_change_color(new_value - @actor.param(param_id)))
    if @actor.class.name == "Terminal" #PXE "Error" Status
      cran = 18
      change_color(text_color(cran))
      xran = rand(10)
      yran = rand(5)
      ranum = rand(1000)
      draw_text(xran + x, yran + y, 32, line_height, ranum, 2)
    else
      draw_text(x, y, 32, line_height, new_value, 2)
    end
  end
end
