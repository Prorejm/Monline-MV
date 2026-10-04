$imported = {} if $imported == nil
$imported["h87_Genericbar"] = true
#===============================================================================
# GENERIC BARS ON MAPS
#===============================================================================
# Author: Holy87
# Version: 1.2
# User difficulty: ★★
#-------------------------------------------------------------------------------
# With this script you can show a bar on the map that indicates anything you
# want. It's possible, through script commands, set position, description and
# bar color, and, obviously, the value.
# It's not completely customizable to be easy to use.
#-------------------------------------------------------------------------------
# Instructions:
# Paste this script under Materials and before the Main. You can set the bar's
# description with a SCRIPT CALL:
# ★ set_genbar("Text"), for the bar title (like Life, Mana etc...)
# when setted, you can use the command to show the bar like this:
# ★ show_bar
# You can set the bar value with a number between 0 and 100, calling the script
# ★ set_bar_value(x), where x is the value.
# to close the windows when you don't need it anymore:
# ★ hide_bar
#
# ADVANCED CONTROLS:
# ★ set_bar("Text",color,x,y)
# wher color is a Color class: Color.new(R,G,B) (R, G and B) are the tonalities
# between 0 and 255, and rapresents the bar color
# x & y are respectively the x and y coordinates of the square
# ★ resize_bar(width, height)
# resizes the aspect of the bar's square
# ★ get_bar_value or get_bar_value(bar_name) returns the bar's value
#
# FOR MORE BARS:
# The previous methods use a default bar, but you can add multiple bars using
# a symbol or a string that identify them.
# ★ add_bar(:bar_name) adds a new generic bar
# ★ remove_bar(:bar_name:) deletes a bar from the map
# ★ set_bar(:bar_name,["Text",color,x,y])
#    adds and sets a new bar on the screen. the bar_name variable identify it
#    (for example, "hungry") identifies a bar that we use for hungry. The values
#    inside the square parenthesys are optional.
# ★ resize_bar(:bar_name, width, height)
#    resizes the square of bar_name
# ★ show_bar(:bar_name) show a bar on the screen
# ★ set_bar_value(:bar_name, x) sets the value x of a specific bar
# ★ hide_bar(:bar_name) hides a bar
#
# USING SPECIAL EFFECTS
# ★ snooze_bar o snooze_bar(:bar_name) make the bar shaking (in example, to
#    symulate an hit received)
#    more options: snooze_bar(:bar_name, timing, strenght)
#    timing: how much time it will shake (15 by default)
#    strenght: the shake strenght (5 by default)
# ★ flash_bar or flash_bar(:bar_name) emits a flash on the bar
#    more options: flash_bar(:bar_name, timing, color)
#    timing: the flash duration (30 by default, ½ of second)
#    color: (white by default) is a Color.new(R, G, B)
# * You can omit :bar_name if it's the default bar.
#-------------------------------------------------------------------------------
# Compatibility:
# classe Spriteset_Map -> alias update, initialize, terminate
#-------------------------------------------------------------------------------

#===============================================================================
# ** Settings
#===============================================================================
module H87_GBSettings
                  #R, G,  B
  Default_Color = [0,120,250]           #Default color
  DefaultX = 10                         #Default X position
  DefaultY = 10                         #Default Y position
  DefaultWidth = 200                    #Default width
  DefaultHeight = 40                    #Default height
  
  BarHeight = 10                        #Bar height
  
end
  #============================================================================
  # ** END OF CONFIGURATION **
  # Edit below this point is risky to anyone can't make scripts.
  #============================================================================
  
  


#===============================================================================
# ** Classe Game_System
#===============================================================================
class Game_System
  include H87_GBSettings          #Including the module
  #-----------------------------------------------------------------------------
  # * Returns the bar's status
  #-----------------------------------------------------------------------------
  def generic_bar_settings(bar = :default)
    @barsettings = {} if @barsettings.nil?
    reset_bar_h(bar) if @barsettings[bar] == nil
    return @barsettings[bar]
  end
  #-----------------------------------------------------------------------------
  # * Resets the bar settings
  #-----------------------------------------------------------------------------
  def reset_bar_h(bar = :default)
    @barsettings[bar] = [
                    bar_defaultx, #PosX
                    bar_defaulty, #PosY
                    bar_defaultw, #Width
                    bar_defaulth, #Heihgt
                    "",           #Name
                    bar_def_colr, #Bar color
                    false,        #Visible?
                    0,            #Percentage
                    false,        #Changed?
                    false         #Width changed
    ]
  end
  #-----------------------------------------------------------------------------
  # * Returns the current scene (VX or VX Ace)
  #-----------------------------------------------------------------------------
  def current_scene
    begin
      return SceneManager.scene
    rescue
      return $scene
    end
  end
  #-----------------------------------------------------------------------------
  # * Returns the bar's default color
  #-----------------------------------------------------------------------------
  def bar_def_colr
    c = Default_Color
    return Color.new(c[0],c[1],c[2])
  end
  #-----------------------------------------------------------------------------
  # * Restituisce la coordinata predefinita
  #-----------------------------------------------------------------------------
  def bar_defaultx
    return DefaultX
  end
  #-----------------------------------------------------------------------------
  # * Restituisce la coordinata predefinita
  #-----------------------------------------------------------------------------
  def bar_defaulty
    return DefaultY
  end
  #-----------------------------------------------------------------------------
  # * Restituisce la larghezza predefinita
  #-----------------------------------------------------------------------------
  def bar_defaultw
    return DefaultWidth
  end
  #-----------------------------------------------------------------------------
  # * Restituisce l'altezza predefinita
  #-----------------------------------------------------------------------------
  def bar_defaulth
    return DefaultHeight
  end
  #-----------------------------------------------------------------------------
  # * Reimposta le proprietà della finestra della barra. Aggiunge una nuova se
  #   il nome non è compreso
  #-----------------------------------------------------------------------------
  def generic_bar_set(letter, colore = bar_def_colr, x = nil, y = nil, bar = :default)
    @barsettings = {} if @barsettings.nil?
    if @barsettings[bar] == nil
      reset_bar_h
      add_active_bar(bar)
    end
    @barsettings[bar][0] = x if x != nil
    @barsettings[bar][1] = y if y != nil
    @barsettings[bar][4] = letter
    @barsettings[bar][5] = colore
    @barsettings[bar][8] = true #flag di modifica per refresh
  end
  #-----------------------------------------------------------------------------
  # * Metodo alternativo per impostare la barra
  #-----------------------------------------------------------------------------
  def set_bar(bar, text, colore = bar_def_colr, x = nil, y = nil)
    generic_bar_set(text, colore, x, y, bar)
  end
  #-----------------------------------------------------------------------------
  # * Restituisce il colore predefinito della barra
  #-----------------------------------------------------------------------------
  def active_bars
    @barsettings = {} if @barsettings.nil?
    return @barsettings
  end
  #-----------------------------------------------------------------------------
  # * Aggiunge una nuova barra
  #-----------------------------------------------------------------------------
  def add_active_bar(bar_name)
    return if bar_name == :default
    @barsettings = {} if @barsettings.nil?
    return if self.active_bars.include?(bar_name)
    @barsettings[bar_name] = reset_bar_h(bar_name)
    current_scene.add_genbar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Rimuove una barra
  #-----------------------------------------------------------------------------
  def remove_active_bar(bar_name)
    return if bar_name == :default
    self.active_bars.delete(bar_name)
    current_scene.remove_genbar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Mostra la finestra della barra
  #-----------------------------------------------------------------------------
  def show_generic_bar(bar = :default)
    @barsettings = {} if @barsettings.nil?
    reset_bar_h(bar) if @barsettings[bar] == nil
    return if @barsettings[bar][6] == true
    @barsettings[bar][6] = true
    @barsettings[bar][8] = true
  end
  #-----------------------------------------------------------------------------
  # * Nasconde la finestra della barra
  #-----------------------------------------------------------------------------
  def hide_generic_bar(bar = :default)
    @barsettings = {} if @barsettings.nil?
    reset_bar_h(bar) if @barsettings[bar] == nil
    return if @barsettings[bar][6] == false
    @barsettings[bar][6] = false
    @barsettings[bar][8] = true
  end
  #-----------------------------------------------------------------------------
  # * Assegna un valore da 0 a 100 per la percentuale della barra
  #-----------------------------------------------------------------------------
  def bar_percentage(value, bar = :default)
    @barsettings = {} if @barsettings.nil?
    reset_bar_h(bar) if @barsettings[bar].nil?
    value = 0 if value < 0
    value = 100 if value > 100
    @barsettings[bar][7] = value
    @barsettings[bar][9] = false
  end
  #-----------------------------------------------------------------------------
  # * restituisce il valore della barra
  #-----------------------------------------------------------------------------
  def get_bar_percentage(bar = :default)
    @barsettings = {} if @barsettings.nil?
    @barsettings[bar][7] = 0 if @barsettings[bar][7] == nil
    return @barsettings[bar][7]
  end
  #-----------------------------------------------------------------------------
  # * Ridimensiona la finestra della barra
  #-----------------------------------------------------------------------------
  def bar_resize(w,h, bar = :default)
    @barsettings[bar][2] = w
    @barsettings[bar][3] = h
    @barsettings[bar][8] = true
  end
end #game_system

#===============================================================================
# ** Classe Barra_Generica
#===============================================================================
class Barra_Generica
  attr_reader   :visible
  attr_reader   :x
  attr_reader   :y
  attr_reader   :width
  attr_reader   :height
  #-----------------------------------------------------------------------------
  # * Inizializzazione
  #-----------------------------------------------------------------------------
  def initialize(viewport, bar_name = :default)
    @bar_name = bar_name
    @lb = H87_GBSettings::BarHeight #altezza barra
    @sp = 5                         #spaziatura
    @viewport = viewport
    @snooze_time = 0
    reset_settings
  end
  #-----------------------------------------------------------------------------
  # * Assegna (o reimposta) le proprietà
  #-----------------------------------------------------------------------------
  def reset_settings(update = false)
    set = $game_system.generic_bar_settings(@bar_name)
    @x = set[0]
    @y = set[1]
    @width = set[2]
    @height = set[3]
    @letter = set[4]
    @color = set[5]
    @visible = set[6]
    start(update)
  end
  #-----------------------------------------------------------------------------
  # * Comincia a creare la grafica
  #   update: true se è già stata creata
  #-----------------------------------------------------------------------------
  def start(update=false)
    create_main_graphic(update)
    create_bar(update)
  end
  #-----------------------------------------------------------------------------
  # * Crea la grafica di sfondo
  #-----------------------------------------------------------------------------
  def create_main_graphic(update)
    @Spriterect.bitmap.clear if update
    barback_color = Color.new(@color.red/2,@color.green/2,@color.blue/2)
    bitmap = Bitmap.new(@width+4, @height+4)
    bitmap.fill_rect(2,2,@width,@height,Color.new(0,0,0,150))
    bitmap.blur
    bitmap.fill_rect(@sp,@height-(@sp+@lb),@width-(@sp*2),@lb,barback_color)
    bitmap.draw_text(@sp,@sp,@width-@sp,24,@letter)
    @Spriterect = Sprite.new(@viewport)
    @Spriterect.bitmap = bitmap
    @Spriterect.x = @x-2
    @Spriterect.y = @y-2
    @visible ? @Spriterect.opacity = 255 : @Spriterect.opacity = 0
  end
  #-----------------------------------------------------------------------------
  # * Crea la grafica della barra
  #-----------------------------------------------------------------------------
  def create_bar(update)
    @bar.bitmap.clear if update                       #pulisci se si deve agg.
    bitmap = Bitmap.new(1,@lb)
    @color = $game_system.generic_bar_settings(@bar_name)[5]
    bitmap.fill_rect(0,0,1,@lb,@color)
    @bar = Sprite.new(@viewport)
    @bar.x = @Spriterect.x + @sp
    @bar.y = @Spriterect.y + @Spriterect.height - @sp-@lb -4
    @bar.bitmap = bitmap
    @bar.zoom_x = 1
    @visible ? @bar.opacity = 255 : @bar.opacity = 0
    $game_system.generic_bar_settings(@bar_name)[9] = false
  end
  #-----------------------------------------------------------------------------
  # * Imposta se mostrare o nascondere la finestra della barra
  #-----------------------------------------------------------------------------
  def visible=(vis)
    @visible = vis
    @visible ? @Spriterect.opacity = 255 : @Spriterect.opacity = 0
    @visible ? @bar.opacity = 255 : @bar.opacity = 0
  end
  #-----------------------------------------------------------------------------
  # * Effetto del flash
  #-----------------------------------------------------------------------------
  def flash(time = 30, color = Color.new(255,255,255))
    @bar.flash(color, time)
    @Spriterect.flash(color, time)
  end
  #-----------------------------------------------------------------------------
  # * Effetto tremolio
  #-----------------------------------------------------------------------------
  def snooze(time = 20, str = 5)
    str = 0 if str < 0
    time = 0 if time < 0
    str = 20 if str > 20
    @snooze_str = str
    @snooze_time = time
  end
  #-----------------------------------------------------------------------------
  # * Aggiornamento
  #-----------------------------------------------------------------------------
  def update
    if $game_system.generic_bar_settings(@bar_name)[8] #controllo refresh
      reset_settings(true)
      $game_system.generic_bar_settings(@bar_name)[8] = false
      return
    end
    if @visible #aggiorna se la finestra è visibile
      bar_update
      snooze_update
      effects_update
    end
  end
  #-----------------------------------------------------------------------------
  # * Aggiornamento del tremolio
  #-----------------------------------------------------------------------------
  def snooze_update
    return if @snooze_time <= 0
    if @snooze_time % 2 == 0
      randx = rand(@snooze_str)-(@snooze_str/2)
      randy = rand(@snooze_str)-(@snooze_str/2)
      @bar.ox = randx
      @bar.oy = randy
      @Spriterect.ox = randx
      @Spriterect.oy = randy
    else
      @bar.ox = 0
      @bar.oy = 0
      @Spriterect.ox = 0
      @Spriterect.oy = 0
    end
    @snooze_time -= 1
    if @snooze_time == 0
      @bar.ox = 0
      @bar.oy = 0
      @Spriterect.ox = 0
      @Spriterect.oy = 0
    end
  end
  #-----------------------------------------------------------------------------
  # * Aggiornamento del flash
  #-----------------------------------------------------------------------------
  def effects_update
    @bar.update
    @Spriterect.update
  end
  #-----------------------------------------------------------------------------
  # * Aggiornamento dell'animazione della barra
  #-----------------------------------------------------------------------------
  def bar_update
    return if $game_system.generic_bar_settings(@bar_name)[9]
    percent = $game_system.generic_bar_settings(@bar_name)[7]
    width = @width-(@sp*2)
    larg = (width.to_f/100.0) * percent
    distanza = larg - @bar.zoom_x
    @bar.zoom_x += distanza/2
    $game_system.generic_bar_settings(@bar_name)[9] = true if distanza <1 and distanza > -1
  end
  #-----------------------------------------------------------------------------
  # * Eliminazione
  #-----------------------------------------------------------------------------
  def dispose
    @bar.bitmap.dispose
    @bar.dispose
    @Spriterect.bitmap.dispose
    @Spriterect.dispose
  end
end #barra

#===============================================================================
# ** Classe Spriteset_Map
#===============================================================================
class Spriteset_Map
  #-----------------------------------------------------------------------------
  # * Alias Inizializzazione
  #-----------------------------------------------------------------------------
  alias bgen_initialize initialize unless $@
  def initialize
    create_generic_bars
    bgen_initialize
  end
  #-----------------------------------------------------------------------------
  # * Alias Uscita
  #-----------------------------------------------------------------------------
  alias bgen_dispose dispose unless $@
  def dispose
    bgen_dispose
    dispose_generic_bars
  end
  #-----------------------------------------------------------------------------
  # * Alias Aggiornamento
  #-----------------------------------------------------------------------------
  alias bgen_update update unless $@
  def update
    bgen_update
    update_generic_bars
  end
  #-----------------------------------------------------------------------------
  # * Creazione finestra con barra
  #-----------------------------------------------------------------------------
  def create_generic_bars
    @generic_bars = {}
    @generic_bars[:default] = Barra_Generica.new(@viewport2)
    $game_system.active_bars.each_key do |name|
      next if name == :default or name.nil?
      @generic_bars[name]=Barra_Generica.new(@viewport2, name)
    end
  end
  #-----------------------------------------------------------------------------
  # * Eliminazione
  #-----------------------------------------------------------------------------
  def dispose_generic_bars
    @generic_bars.each do |bar|
      bar[1].dispose
    end
  end
  #-----------------------------------------------------------------------------
  # * Aggiornamento
  #-----------------------------------------------------------------------------
  def update_generic_bars
    @generic_bars.each do |gbar|
       gbar[1].update
     end
  end
  #-----------------------------------------------------------------------------
  # * Aggiunge una barra
  #-----------------------------------------------------------------------------
  def add_gen_bar(bar_name)
    @generic_bars[bar_name] = Barra_Generica.new(@viewport2, bar_name)
    print @generic_bars.size
  end
  #-----------------------------------------------------------------------------
  # * Rimuove una barra
  #-----------------------------------------------------------------------------
  def remove_gen_bar(bar_name)
    bar = @generic_bars[bar_name]
    bar.visible = false
    bar.dispose
    @generic_bars.delete(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Flash alla barra
  #-----------------------------------------------------------------------------
  def bar_flash(time, color, bar)
    return if @generic_bars[bar].nil?
    @generic_bars[bar].flash(time, color)
  end
  #-----------------------------------------------------------------------------
  # * Tremolio della barra
  #-----------------------------------------------------------------------------
  def bar_snooze(time, str, bar)
    return if @generic_bars[bar].nil?
    @generic_bars[bar].snooze(time, str)
  end
end #spriteset_map

#===============================================================================
# ** Classe Game_Interpreter
#===============================================================================
class Game_Interpreter
  #-----------------------------------------------------------------------------
  # * Sets a bar
  #-----------------------------------------------------------------------------
  def set_bar(*args)
    if args.size > 1 && !args[1].is_a?(Color)
      set_custom_bar(*args)
    else
      set_genbar(*args)
    end
  end
  #-----------------------------------------------------------------------------
  # * Reimposta le proprietà della barra
  #-----------------------------------------------------------------------------
  def set_genbar(text, color = bar_def_colr, x = nil, y = nil)
    $game_system.generic_bar_set(text, color, x, y)
  end
  #-----------------------------------------------------------------------------
  # * Reimposta una barra generica
  #-----------------------------------------------------------------------------
  def set_custom_bar(bar_name, letter, color = bar_def_colr, x = nil, y = nil)
    $game_system.generic_bar_set(letter, color, x, y, bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Nascondi barra
  #-----------------------------------------------------------------------------
  def hide_bar(bar_name = :default)
    $game_system.hide_generic_bar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Mostra barra
  #-----------------------------------------------------------------------------
  def show_bar(bar_name = :default)
    $game_system.show_generic_bar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Set a bar value
  #-----------------------------------------------------------------------------
  def set_bar_value(*args)
    args.size > 1 ? bar_value(args[1], args[0]) : bar_value(*args)
  end
  #-----------------------------------------------------------------------------
  # * Assegna valore barra
  #-----------------------------------------------------------------------------
  def bar_value(value, bar_name = :default)
    $game_system.bar_percentage(value, bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Right method for resizing bars
  #-----------------------------------------------------------------------------
  def resize_bar(*args)
    args.size > 2 ? bar_resize(args[1], args[2], args[0]) : bar_resize(*args)
  end
  #-----------------------------------------------------------------------------
  # * Ridimensiona finestra
  #-----------------------------------------------------------------------------
  def bar_resize(width, height, bar_name = :default)
    $game_system.bar_resize(width,height,bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Aggiunge una barra personalizzata
  #-----------------------------------------------------------------------------
  def add_bar(bar_name)
    $game_system.add_active_bar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Rimuove una barra personalizzata
  #-----------------------------------------------------------------------------
  def remove_bar(bar_name)
    $game_system.remove_active_bar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Flash
  #-----------------------------------------------------------------------------
  def flash_bar(*args)
    if args.size == 0 || !args[0].is_a?(Integer)
      flash_bar_old(*args)
    else
      flash_bar_old(:default, *args)
    end
  end
  #-----------------------------------------------------------------------------
  # * Old Flash method
  #-----------------------------------------------------------------------------
  def flash_bar_old(bar = :default, time = 30, color = Color.new(255,255,255))
    $game_system.current_scene.bar_flash(time, color, bar)
  end
  #-----------------------------------------------------------------------------
  # * Shake
  #-----------------------------------------------------------------------------
  def snooze_bar(*args)
    if args.size == 0 || !args[0].is_a?(Integer)
      snooze_bar_old(*args)
    else
      snooze_bar_old(:default, *args)
    end
  end
  #-----------------------------------------------------------------------------
  # * Shake (old method)
  #-----------------------------------------------------------------------------
  def snooze_bar_old(bar = :default, time = 15, str = 5)
    $game_system.current_scene.bar_snooze(time, str, bar)
  end
  #-----------------------------------------------------------------------------
  # * Assign color
  #-----------------------------------------------------------------------------
  def bar_def_colr
    c = H87_GBSettings::Default_Color
    return Color.new(c[0],c[1],c[2])
  end
end #game_interpreter

#===============================================================================
# ** Classe Scene_Base
#===============================================================================
class Scene_Base
  #-----------------------------------------------------------------------------
  # * Metodi vuoti, servono per non generare errori se non si è sulla mappa.
  #-----------------------------------------------------------------------------
  def add_genbar(bar_name);end
  def remove_genbar(bar_name);end
  def bar_flash(time, color, bar);end
  def bar_snooze(time, str, bar);end
end #scene_base
  
#===============================================================================
# ** Classe Scene_Map
#===============================================================================
class Scene_Map < Scene_Base
  #-----------------------------------------------------------------------------
  # * Aggiunge una barra allo spriteset
  #-----------------------------------------------------------------------------
  def add_genbar(bar_name)
    @spriteset.add_gen_bar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Rimuove una barra dallo spriteset
  #-----------------------------------------------------------------------------
  def remove_genbar(bar_name)
    @spriteset.remove_gen_bar(bar_name)
  end
  #-----------------------------------------------------------------------------
  # * Flash barra dello spriteset
  #-----------------------------------------------------------------------------
  def bar_flash(time, color, bar)
    @spriteset.bar_flash(time, color, bar)
  end
  #-----------------------------------------------------------------------------
  # * Tremolio alla barra dello spriteset
  #-----------------------------------------------------------------------------
  def bar_snooze(time, str, bar)
    @spriteset.bar_snooze(time,str,bar)
  end
end #scene_map