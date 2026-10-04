class Game_Actor
  
  alias theo_param_max param_max
  def param_max(param_id)
    return 50 if param_id > 1
    return theo_param_max(param_id)
  end
  
end

class Window_StatusItem
  def draw_parameter_graph
    draw_parameter_title
    dy = line_height * 3/2
    for i in 2..7
      rate = @actor.param(i) / @actor.param_max(i).to_f
      dy = line_height * i - line_height/2
      draw_param_gauge(i, dy, rate)
      change_color(system_color)
      draw_text(28, dy, contents.width - 56, line_height, Vocab::param(i))
      dw = (contents.width - 48)
      change_color(normal_color)
      draw_text(28, dy, dw, line_height, @actor.param(i).group, 2)
    end
  end
end