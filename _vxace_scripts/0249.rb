class Scene_Battle < Scene_Base
  #--------------------------------------------------------------------------
  # overwrite : Check Substitute Condition
  #--------------------------------------------------------------------------
  def check_substitute(target, item)
    (!item || !item.certain?)
  end
end