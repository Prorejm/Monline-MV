#==============================================================================
#    Monster Catalogue
#    Version: 1.1
#    Author: modern algebra (rmrk.net)
#    Date: March 24, 2012
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Description:
#
#    This script creates a scene that you can call which shows data on any and
#   all monsters you have collected. You can change the exact point at which
#   data will show up. By default, the script will show only ?????? for any 
#   monsters not yet fought, but once they are first encountered by the player 
#   then the monster's name, battler, and stats will show up. There are options 
#   to change that though. For instance, you could make it so that only the 
#   monster's name and battler will show up when the monster is encountered, 
#   and to show the stats you will need to use a special analyze item, which 
#   you can set up in the database by simply putting \analyze in an item or 
#   skill's notebox.
#
#    Additionally, you can give the enemies species and use different 
#   categories to separate them.
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Instructions:
#
#    Paste this script into its own slot in the Script Editor, above Main but
#   below Materials.
#
#    This script can be mostly plug & play, but there are a few configuration
#   options worth playing around with and a bunch of totally useless 
#   configuration options I added in a fit of paranoia. 
#
#    The most important options are from lines 102-263, and I explain what
#   each option does in a comment directly preceding it, so I will ask you to
#   look through that section in detail.
#``````````````````````````````````````````````````````````````````````````````
#  Notetags for Enemies:
#
#    \desc{description of the monster} - This allows you to give each monster
#       a description which will appear in the bottom window in the Monster 
#       Catalogue scene. You can use \N to go to the next line, and you can
#       also use any normal message codes like \c[n], \v[n], etc... If you do
#       not want to give monsters descriptions, you can turn the window off by
#       changing the value of :desc_window_lines to 0 at line 270.
#
#    \species[id] - This allows you to give each enemy a species, which will be
#      shown by its icon and text directly below the monster's name in the data
#      window. You set up the species in the :species array at line 187.
#
#    \hide_from_catalogue - This will prevent the monster from ever showing up
#      in the catalogue. It is useful for dummy monsters or, for instance, boss
#      monsters. You can hide or reveal a monster using the following codes in
#      a script call of an event (see lines 84-89 for more detail):
#          hide_monster(id)
#          reveal_monster(id)
#
#    \category[x, y, z] - This allows you to add a monster to categories, which
#      you can then add to your monster catalogue to make navigation easier. 
#      See lines 239-250 for more detail.
#
#    \silhouette["filename", hue] - If you are using the silhouette feature, 
#      this allows you to set a silhouette graphic to be loaded for a monster, 
#      instead of automatically generated (since automatic generation is slow).
#      See lines 224-237 for more details.
#
#    \icon[index] - This lets you set an icon for each monster, which will then
#      be shown to the left of its name in the list.
#``````````````````````````````````````````````````````````````````````````````
#  Notetags for Items and Skills:
#
#    \analyze - This will identify an item or skill as an analyzing item or
#      skill, which means that when it is used, a data window on the enemy will
#      be shown in battle, and further, that enemy will be considered analyzed.
#      You can use analyze status as a criterion for showing data, etc. in the
#      regular catalogue as well. See lines 104-140.
#``````````````````````````````````````````````````````````````````````````````
#  Script Calls in Events:
#
#    encounter_monster(id)
#      This will manually set a monster as encountered. See lines 104-140.
#
#    analyze_monster(id)
#      This will manually set a monster as analyzed. See lines 104-140.
#
#    hide_monster(id)
#      This will set it so the identified monster will not show up in the
#     catalogue under any conditions
#
#    reveal_monster(id)
#      This will set it so the identified monster is no longer hidden
#
#    call_monster_catalogue
#      This will call the Monster Catalogue scene.
#==============================================================================

$imported ||= {}
$imported[:MA_MonsterCatalogue] = true

MAMC_CONFIG = {
  #\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
  #  BEGIN Editable Region
  #||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
  #  Useful Options
  #````````````````````````````````````````````````````````````````````````````
  #  The first four options all have this in common - they can be set to one of
  # the following values:
  #    :always    - The value to be shown will always be shown
  #    :encounter - The value to be shown will be shown once the monster has 
  #                been encountered. You can either manually encounter an enemy
  #                through a call script, or it will automatically happen the
  #                first time the party fights that kind of enemy.
  #    :analyze   - The value to be shown will be shown once the monster has 
  #                been analyzed. You can set either manually analyze an enemy
  #                through a call script, or you can do it by setting items and
  #                skills to be \analyze items that, when used, will analyze
  #                a monster and show data on it. By default, I do not use this
  #                option for anything.
  #````````````````````````````````````````````````````````````````````````````
  # :show_entry_when - When does the monster show up in the catalogue? Note 
  #    that hidden enemies will never show up, regardless of your choice here, 
  #    and also note that unless either the battler or data are to be shown, 
  #    the name of the monster will not be shown even if it is present.
  :show_entry_when => :encounter,      
  
  # :show_battler_when - When does the monster's battler show up when looking
  #    at that enemy in the catalogue? Note that if the data is shown, the 
  #    battler will automatically be shown anyway.
  :show_battler_when => :encounter, 
  
  # :show_data_when - When does the monster's stats show up when looking at 
  #    that enemy in the catalogue? 
  :show_data_when => :encounter, 
  
  # :complete_when - This feature is only useful if you are tracking completion
  #    and showing it. This tracks when a monster is counted as collected, so 
  #    as to show up in the left side of the completion.
  :complete_when => :encounter,
  
  # :show_completion - This feature allows you to choose whether to track 
  #    completion. If set to :none, then it will not show up at all in the 
  #    catalogue. If set to :fraction, then it will show up as a fraction like
  #    x/y where x is the amount of monsters you have completed (as per the 
  #    :complete_when condition) and y is the total number of monsters in the
  #    category. If set to :percent, it will show up as a percentage - ie. if 
  #    you have collected 8 out of 50 monsters, it will show up as 16%
  :show_completion => :fraction, 
  
  # :absent_monster_name - If a monster entry is shown but neither the battler 
  #    nor the stats are shown, this replaces the name of the monster. If you
  #    actually still want the name to be shown, then you can put "%s" as the
  #    value.
  :absent_monster_name => "???",
  
  # :shown_stats - This determines which stats of a monster are shown when 
  #    data is shown for the monster. You also must set the corresponding text
  #    to be shown. Ie. each line must be something like:
  #
  #        :stat => "Label",
  #
  #      :stat must correspond to a method name in Game_Enemy or its 
  #    superclasses or inherited modules, or else it will not be shown. Some 
  #    valid values for this are: :mhp, :mmp, :atk, :def, :mat, :mdf, :agi, 
  #    :luk, :hit, :eva, :cri, :exp, :gold, :cev, :mev, :mrf, :cnt, :hrg, :mrg, 
  #    :trg, :tgr, :grd, :rec, :pha, :mcr, :tcr, :pdr, :mdr, :fdr, and :exr.
  #
  #      "Label" is the text to be drawn. Note that if the "Label" is a String, 
  #    then that word will be drawn. However, if you make :"Label" a symbol by 
  #    putting a colon before the quotation marks, then the text shown will be
  #    the result of evaluationg "Label". This is useful since it allows you 
  #    to use terms in Vocab, meaning it will change depending on what you put 
  #    in the database and you don't have to change it again here.
  #
  #   EXAMPLE Lines:
  #    where the Enemy's Attack is 45, the enemy's hit rate is 95, and the name 
  #    of the Attack parameter set in Terms is ATK.
  #      :atk => :"Vocab.param(2)",
  #        shows up as:      ATK          45
  #      :atk => "DMG",
  #        shows up as:      DMG          45
  #      :hit => "HIT", 
  #        shows up as:      HIT          95%
  :shown_stats => { # <= Do not touch
    :mhp  => :"Vocab.hp",
    :mmp  => :"Vocab.mp",
    :atk  => :"Vocab.param(2)",
    :def  => :"Vocab.param(3)",
    :mat  => :"Vocab.param(4)",
    :mdf  => :"Vocab.param(5)",
    :agi  => :"Vocab.param(6)",
    :luk  => :"Vocab.param(7)",
  }, # <= Do not touch
  
  # :stats_label - This is the label placed just above the Stats section.
  :stats_label => "Stats",
  
  # :species - This allows you to give monsters species, and the icon and name
  #    of the species will show up underneath its name once data is revealed. 
  #    Each line must be in the format:
  #
  #        [icon_index, "name"],
  #
  #      icon_index is the Integer index of the icon you want to use
  #      "name" is a String and is the name of the species.
  #
  #    Then, to assign a species to an Enemy, all you need to do is put the 
  #    following code in its notebox:
  #
  #        \species[n]
  #
  #      n is the ID of the species, which is its place in the following array.
  #        Note that 0 is not used - it starts at 1.
  :species => [
    [9072, "Divine"],      # ID: 1 - Angel
    [9073, "Beast"],       # ID: 2 - Beast
    [9074, "Bird"],        # ID: 3 - Bird
    [9075, "Humanlike"],   # ID: 4 - Humanlike
    [9076, "Devil"],       # ID: 5 - Devil
    [9077, "Elemental"],   # ID: 6 - Elemental
    [9078, "Anomaly"],     # ID: 7 - Anomaly
    [9079, "Fish"],        # ID: 8 - Fish
    [9080, "Golem"],       # ID: 9 - Golem
    [9081, "Insect"],      # ID: 10 - Insect
    [9082, "Empowered"],   # ID: 11 - Empowered
    [9083, "Plant"],       # ID: 12 - Plant
    [9084, "Reptile"],     # ID: 13 - Reptile  
    [9085, "Slime"],       # ID: 14 - Slime 
    [9086, "Undead"],      # ID: 15 - Undead 
    [9087, "Yokai"],       # ID: 16 - Yokai 
    [9071, "Human"],       # ID: 17 - Human 
  ],
  
  # :menu_access - This value determines whether the Bestiary is accessible 
  #    from a command in the menu. If true, then it is. If false, it isn't.
  :menu_access => false,
  
  # :menu_index - If :menu_access is true, then this value determines where in
  #    the menu command window it is inserted.
  :menu_index => 4,
  # :menu_label - If :menu_access is true, then this value determines the name
  #    of the command in the menu
  :menu_label => "Bestiary",
  # :map_access - This value determines whether the catalogue is accessible by 
  #    pressing a button in the map. If true, then it is. If false, it isn't.
  :map_access => false,
  #  :map_button - If :map_access is true, then this is the button that needs
  #    to be pressed in order to open the catalogue from the map.
  :map_button => :R,
  # :silhouette - This value determines whether, if the battler is not yet 
  #    shown for a monster in the catalogue, it should show a silhouette. The
  #    silhouette can be automatically generated, but that is a time-consuming 
  #    process, especially for larger battlers. Lag may be experienced. If you
  #    do want this feature on, however, then there is an option to have the
  #    silhouette graphic be loaded directly from the Battlers folder by 
  #    placing the following code in an Enemy's notebox:
  #
  #      \silhouette["Filename", hue]
  #
  #        "Filename" is the filename of the Graphic in Battlers to be loaded
  #        hue is an integer between 0 and 360 and setss the graphic's hue
  #
  #    That can be especially useful to avoid lag with larger battlers.
  :silhouette => false,
  # :categories - This lets you create categories of monsters, and the setup is
  #    identical to :species (see line 191). The first entry in the array must 
  #    be the "All" category; it includes every monster and the ID for it is 0. 
  #    However, the next ones can be whatever you want. To add an enemy to a
  #    category, you just need to put the following code into its notebox:
  #
  #      \category[x]
  #  
  #    Where x is the ID of the category you want to put it in. One monster can
  #    be in as many categories as you want, so you can put more in, like this:
  #
  #      \category[x, y, z]
  :categories => [
    [334, "Bestiary"],        # ID: 0 - All Enemies
    [8870, "Forest Zone"],    # ID: 1 - Forest Zone
    [8871, "Coastal Zone"],   # ID: 2 - Coastal Zone
    [8872, "Demon Zone"],     # ID: 3 - Demon Zone
    [8873, "Desolate Zone"],  # ID: 4 - Desolate Zone
    [8874, "Desert Zone"],    # ID: 5 - Forest Zone
    [8875, "Mythic Zone"],    # ID: 6 - Mythic Zone
    [8876, "Tower Zone"],     # ID: 7 - Tower Zone
    [8877, "Unknown Area"],   # ID: 8 - No Zone
  ],
  # :shown_categories - This is the order of the categories in the catalogue. 
  #    It must be an array of the IDs of the above set categories. If you only
  #    put in one number, then the category window won't be shown in the 
  #    catalogue and it will just always show the specified category.
  :shown_categories => [1,2,3,4,5,6,8],
  # :hide_category_cursor - If you are using the categories feature, then this
  #    value determines whether a cursor should be shown in that window or 
  #    whether it should just rely on the fact that only the icon of the 
  #    selected category is enabled.
  :hide_category_cursor => true,
  #||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
  #  Superfluous options
  #````````````````````````````````````````````````````````````````````````````
  # :list_window_width - This allows you to set, in pixels, the width of the 
  #    window which lists the monsters in the catalogue.
  :list_window_width => 216,
  # :desc_window_lines - This allows you to choose how many lines will fit in
  #    the help window. If set to 0, there will be no help window to show
  #    description.
  :desc_window_lines => 1,
  # :sort_by - This allows you to choose how the monsters are sorted in the 
  #    list. It can only be one of the following options:
  #      :id - The monsters will be ordered from the smallest ID to the largest
  #      :alphabet - The monsters will be in alphabetical order
  #      :encounter - The monsters will be in the order they were encountered
  :sort_by => :encounter, 
  # :number_by - This option allows you to number the monsters in the list. It
  #    can be one of three options:
  #      :none - The monsters will not be numbered
  #      :id - The monsters will be numbered by their ID
  #      :index - The monsters will be numbered by the order they are in
  :number_by => :none,
  
  # :number_format - If :number_by is not :none, then this is the format the 
  #    number will show up in. %d is where the number will show up, so "%d. "
  #    will show up as: 
  #      1. name
  #      2. name (etc.)
  #    while something like "(%d) " would show up as:
  #      (1) name
  #      (2) name (etc.)
  :number_format => "%d. ",
  # :frame_width - The width, in pixels of the frame for the monster data.
  :frame_width => 2,
  
  # :battler_opacity - The opacity of the battler when drawn
  :battler_opacity => 255,
  
  # :battler_opacity_under_stats - Some large battlers extend over the stats
  #    region of the window. This sets the opacity for that section of the 
  #    battler.
  :battler_opacity_under_stats => 128,
  
  # :windowskin - This sets the windowskin to be used in the Monster Catalogue
  #    scene. It must be a graphic in the System folder of Graphics. If set to
  #    false, it will use whatever windowskin is default. 
  :windowskin => false,
  
  # :font_name - The font to be used in the Monster Catalogue scene. It can
  #    be either a String, an Array, or false. If false, it will use the 
  #    default font. If a String, it will use that font. If an array, it will 
  #    use the first font in the array that the player has installed. 
  :font_name => false,
  
  # :show_monster_icon - This feature allows you to set it so that an icon is
  #    shown to the left of each monster's name in the list. To set what icon 
  #    will show, you would use the following code in a notebox of an Enemy:
  #
  #      \icon[index]
  #
  #    where index is the index of the icon you want to use.
  :show_monster_icon => false,
  # :inherit_species_icon - If :show_monster_icon is on, then you can turn this
  #    value to true and, if you do not directly set an icon for a monster, 
  #    then it will use the icon for its species.
  :inherit_species_icon => true,
  #````````````````````````````````````````````````````````````````````````````
  # Colours - the next seven options all set colours for various things. They
  #   can accept the following values:
  #     Integer - if an integer, then it will choose the colour from the 
  #       windowskin palette.
  #     Array - if an array, it must have between three and four entries and
  #       the first three will be the rgb values and the last is optional and
  #       it will be the alpha (opacity).
  #     Symbol - if a symbol, then the colour chosen will be the result of
  #       calling that method.
  #````````````````````````````````````````````````````````````````````````````
  # :system_colour - This allows you to change the colour of all of the labels
  #    and other text that are drawn in the system color.
  :system_colour => :system_color,
  # :normal_colour - This allows you to change the colour of all of the values
  #    and other text that are drawn in the normal color.
  :normal_colour => :normal_color,
  # :frame_colour - This allows you to select the colour of the frame
  :frame_colour => :system_color,
  # :frame_shadow_colour - This allows you to select the colour of the frame's
  #    shadow.
  :frame_shadow_colour => [0, 0, 0, 128],
  # :species_colour - This allows you to select the colour for the species name
  :species_colour => 8,
  # :silhouette_colour - This allows you to select the colour of the silhouette
  #    if you are using that feature and automatically generating them.
  :silhouette_colour => [0, 0, 0],
  # :complete_colour - This allows you to select the colour the completion stat
  #    is drawn in when all monsters in a category are collected.
  :complete_colour => 3,
  #````````````````````````````````````````````````````````````````````````````
  # :completion_label - This must be a string. If it is empty, then the 
  #    completion stat will simply be drawn centred. If the string isn't empty,
  #    then this text will be drawn on the left in system_color and the 
  #    completion stat will be aligned to the right.
  :completion_label => "", 
  # :percent_format - If showing the completion stat in fraction format, this 
  #    allows you to choose how it shows up. The first %d will be replaced by
  #    the number completed and the second %d will be replaced by the total 
  #    number of monsters in the category
  :fraction_format => "%d/%d",
  # :percent_format - If showing the completion stat in percent format, this 
  #    allows you to choose how it shows up. The %.1f will be replaced by the
  #    completion percentage to 1 decimal place. %% will be replaced by %
  :percent_format => "%.1f%%",
  #||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
  # END Editable Region
  #////////////////////////////////////////////////////////////////////////////
}

MAMC_CONFIG[:categories] = [[334, "Monster Catalogue"]] if MAMC_CONFIG[:categories].nil? || MAMC_CONFIG[:categories].empty?
MAMC_CONFIG[:shown_categories].reject! { |n| MAMC_CONFIG[:categories][n] == nil }
MAMC_CONFIG[:shown_categories] = [0] if MAMC_CONFIG[:shown_categories].empty?

#==============================================================================
# ** RPG::UsableItem
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    new method - mamc_analyze?
#==============================================================================

class RPG::UsableItem
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Analyze Item
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def mamc_analyze?
    @mamc_analyze = !self.note[/\\ANALYZE/i].nil? if !@mamc_analyze
    @mamc_analyze
  end
end

#==============================================================================
# ** RPG::Enemy
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    new method - description; icon_index; species_id; category_ids; 
#      silhouette_battler; mamc_hide?
#==============================================================================

class RPG::Enemy
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Description
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def description(*args, &block)
    if !@mamc_description
      @mamc_description = super(*args, &block)
      if note[/\\(DESCRIPTION|DESC)\{(.+?)\}/im]
        @mamc_description = $2
        @mamc_description.gsub!(/[\r\n]/, "")
        @mamc_description.gsub!(/\\[Nn]/, "\n")
      end
      @mamc_description = "" unless @mamc_description.is_a?(String)
    end
    @mamc_description
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Icon Index
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def icon_index(*args, &block)
    if !@mamc_icon_index
      @mamc_icon_index = super(*args, &block)
      if note[/\\ICON\[\s*(\d+)\s*\]/i]
        @mamc_icon_index = $1.to_i
      elsif MAMC_CONFIG[:inherit_species_icon]
        # Species Icon
        @mamc_icon_index = MAMC_CONFIG[:species][species_id - 1][0]
      end
      @mamc_icon_index = 0 unless @mamc_icon_index.is_a?(Integer)
    end
    @mamc_icon_index
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Species ID
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def species_id
    if !@mamc_species_id 
      @mamc_species_id = (self.note[/\\SPECIES\[\s*(\d+)\s*\]/i] ? $1.to_i : 0)
    end
    @mamc_species_id
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Category IDs
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def category_ids
    if !@mamc_category_ids
      @mamc_category_ids = [0]
      if self.note[/\\CATEGOR(Y|IES)\[(.+?)\]/i] != nil
        @mamc_category_ids |= $2.scan(/\d+/).collect { |id| id.to_i } 
      end
    end
    @mamc_category_ids
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Hide?
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def mamc_hide?
    @mamc_hide = !self.note[/\\HIDE_FROM_CATALOG/i].nil? if !@mamc_hide
    @mamc_hide
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Silhouette Battler
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def silhouette_battler
    if !@mamc_silhouette_battler
      @mamc_silhouette_battler = []
      if self.note[/\\SILHOUETTE\[\s*["'](.+?)["'][,;:\s]*H?(\d*)\s*\]/i]
        @mamc_silhouette_battler.push($2.to_i)
        @mamc_silhouette_battler.unshift($1.gsub(/[\r\n]/, ""))
      end
    end
    @mamc_silhouette_battler
  end
end

#==============================================================================
# ** Game_System
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    new methods - mamc_encounter_ary; mamc_analyze_ary; mamc_hide_ary;
#      mamc_encounter_monster; mamc_analyze_monster; mamc_data_conditions_met?
#==============================================================================

class Game_System
  [:encounter, :analyze].each { |method|
    #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    # * Encounter/Analyze Array
    #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    define_method(:"mamc_#{method}_ary") do 
      instance_variable_set(:"@mamc_#{method}_ary", []) if instance_variable_get(:"@mamc_#{method}_ary").nil?
      instance_variable_get(:"@mamc_#{method}_ary")
    end
    #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    # * Encounter/Analyze Monster
    #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    define_method(:"mamc_#{method}_monster") do |*args|
      ary = send(:"mamc_#{method}_ary")
      instance_variable_set(:"@mamc_#{method}_ary", ary | args)
    end
  }
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Hidden Array
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def mamc_hide_ary
    if !@mamc_hide_ary
      @mamc_hide_ary = []
      $data_enemies.compact.each { |enemy| @mamc_hide_ary.push(enemy.id) if enemy.mamc_hide? }
    end
    @mamc_hide_ary
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Data Conditions Met?
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def mamc_data_conditions_met?(condition, monster_id = 0)
    return case condition
    when :always then true
    when :encounter then mamc_encounter_ary.include?(monster_id)
    when :analyze then mamc_analyze_ary.include?(monster_id)
    else
      false
    end
  end
end

#==============================================================================
# ** Game_Enemy
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    new public instance variable - mamc_analyze_now
#    aliased method - on_battle_start; item_user_effect
#==============================================================================

class Game_Enemy
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Public Instance Variables
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  attr_accessor :mamc_analyze_now
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Die/Transform
  #``````````````````````````````````````````````````````````````````````````
  # Add to encounter array whenever the enemy dies or is transformed
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  [:die, :transform].each { |meth|
    alias_method(:"mamc_enem#{meth}_2aw1", meth)
    define_method(meth) do |*args|
      $game_system.mamc_encounter_monster(enemy.id) if exist? && enemy
      send(:"mamc_enem#{meth}_2aw1", *args)
    end
  }
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Item User Effect
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  alias mamc_itmusreffect_2dw9 item_user_effect
  def item_user_effect(user, item, *args, &block)
    mamc_itmusreffect_2dw9(user, item, *args, &block)
    if item.mamc_analyze?
      $game_system.mamc_analyze_monster(enemy.id)
      @mamc_analyze_now = true
      @result.success = true
    end
  end
end

#==============================================================================
# ** Game_Interpreter
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    new methods - encounter_monster; analyze_monster; hide_monster;
#      reveal_monster; call_monster_catalogue
#==============================================================================

class Game_Interpreter
  [:encounter, :analyze].each { |method|
    #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    # * Encounter/Analyze Monster
    #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    define_method(:"#{method}_monster") do |*args| 
      $game_system.send(:"mamc_#{method}_monster", *args) 
    end
  }
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Hide/Reveal Monster
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def hide_monster(monster_id)
    $game_system.mamc_hide_ary.push(monster_id) unless $game_system.mamc_hide_ary.include?(monster_id)
  end
  def reveal_monster(monster_id)
    $game_system.mamc_hide_ary.delete(monster_id)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Call Monster Catalogue
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def call_monster_catalogue
    return if $game_party.in_battle
    SceneManager.call(Scene_MonsterCatalogue)
    Fiber.yield
  end
end

#==============================================================================
# *** MAMC_WindowAdditions
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  This module adds a few methods to MAMC windows
#==============================================================================

module MAMC_WindowAdditions
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Object Initialization
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def initialize(*args, &block)
    super(*args, &block)
    self.windowskin = Cache.system(MAMC_CONFIG[:windowskin]) if MAMC_CONFIG[:windowskin]
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Reset Font Settings / Create Contents
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  [:reset_font_settings, :create_contents].each { |method|
    define_method(method) do |*args|
      super(*args)
      contents.font.name = MAMC_CONFIG[:font_name] if MAMC_CONFIG[:font_name]
    end
  }
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * MA Text Color
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def text_color(param)
    begin 
      colour = case param
      when Integer then super(param) rescue normal_color
      when Symbol then send(param) rescue normal_color
      when Array then Color.new(*param) rescue normal_color
      else
        normal_color
      end
    end
    colour.is_a?(Color) ? colour : normal_color
  end
  def normal_color
    c = MAMC_CONFIG[:normal_colour]
    c == :normal_color ? super : text_color(c)
  end
  def system_color
    c = MAMC_CONFIG[:system_colour]
    c == :system_color ? super : text_color(c)
  end
end

#==============================================================================
# ** Window_MonsterCategory
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  This window is a horizontal command window using icons to represent species
#==============================================================================

class Window_MonsterCategory < Window_HorzCommand
  include MAMC_WindowAdditions
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Public Instance Variable
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  attr_reader :monsterlist_window
  attr_reader :label_window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Window Width
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def window_width
    MAMC_CONFIG[:list_window_width]
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Column Max
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def col_max
    [(width - standard_padding) / (24 + spacing), item_max].min
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Current Item Enabled?
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def current_item_enabled?
    !current_data.nil?
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Make Command List
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def make_command_list
    MAMC_CONFIG[:shown_categories].each { |cat|
      ary = MAMC_CONFIG[:categories][cat]
      add_command(ary[1], :"#{cat}", false, ary[0])
    }
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Item
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_item(index)
    rect = item_rect(index)
    contents.clear_rect(rect)
    draw_icon(@list[index][:ext], rect.x + ((rect.width - 24) / 2), rect.y, enable?(index))
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Enabled?
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def enable?(index)
    self.index == index
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Set Index
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def index=(index)
    old_index = self.index
    super(index)
    draw_item(old_index)
    draw_item(self.index)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Frame Update
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def update
    super
    @monsterlist_window.category = MAMC_CONFIG[:shown_categories][index] if @monsterlist_window
    @label_window.category = MAMC_CONFIG[:shown_categories][index] if @label_window
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Set Monster Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def monsterlist_window=(monsterlist_window)
    @monsterlist_window = monsterlist_window
    update
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Set Monster Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def label_window=(label_window)
    @label_window = label_window
    update
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Update Cursor
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def update_cursor
    super
    cursor_rect.empty if MAMC_CONFIG[:hide_category_cursor]
  end
end

#==============================================================================
# ** Window_MonsterCategoryLabel
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  This window shows the name of the species
#==============================================================================

class Window_MonsterCategoryLabel < Window_Base
  include MAMC_WindowAdditions
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Object Initialization
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def initialize(x, y)
    super(x, y, window_width, window_height)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Refresh
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def refresh(category_id = @category)
    contents.clear
    change_color(system_color)
    contents.font.bold = true
    draw_text(0, 0, contents_width, line_height, MAMC_CONFIG[:categories][category_id][1], 1)
    contents.font.bold = false
    draw_completion(0, line_height) unless MAMC_CONFIG[:show_completion] == :none
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Completion
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_completion(x, y)
    if !MAMC_CONFIG[:completion_label].empty?
      change_color(system_color)
      draw_text(x, y, contents_width, line_height, MAMC_CONFIG[:completion_label])
      align = 2
    else
      align = 1
    end
    a, b = get_completion
    colour = a == b ? text_color(MAMC_CONFIG[:complete_colour]) : normal_color
    change_color(colour)
    draw_text(x, y, contents_width, line_height, completion_to_s(a, b), align)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Get Completion
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def get_completion
    a, b = 0, 0
    $data_enemies.compact.each { |enemy| 
      if enemy.category_ids.include?(@category) && !$game_system.mamc_hide_ary.include?(enemy.id)
        b += 1
        a += 1 if $game_system.mamc_data_conditions_met?(MAMC_CONFIG[:complete_when], enemy.id)
      end
    }
    return a, b
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Completion String
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def completion_to_s(x, y)
    return "" if y == 0
    case MAMC_CONFIG[:show_completion]
    when :fraction then sprintf(MAMC_CONFIG[:fraction_format], x, y)
    when :percent then sprintf(MAMC_CONFIG[:percent_format], (x.to_f / y)*100)
    else
      ""
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Set Category
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def category=(category)
    return if @category == category
    @category = category
    refresh
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Window Width
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def window_width
    MAMC_CONFIG[:list_window_width]
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Window Height
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def window_height
    hght = (standard_padding*2) + line_height
    hght += line_height unless MAMC_CONFIG[:show_completion] == :none
    hght
  end
end

#==============================================================================
# ** Window_MonsterList
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  This window shows all monsters in a selected category.
#==============================================================================

class Window_MonsterList < Window_Selectable
  include MAMC_WindowAdditions
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Object Initialization
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def initialize(x, y, width, height)
    super
    @data = []
    self.index = 0
    activate
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Set Category
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def category=(category)
    return if @category == category
    @category = category
    refresh
    self.index = 0
    self.oy = 0
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Column Max
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def col_max
    1
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Item Maximum
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def item_max
    @data ? @data.size : 1
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Get monster
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def item
    @data && index >= 0 ? @data[index] : nil
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Current Item Enabled?
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def current_item_enabled?
    enable?(@data[index])
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Whether to include an item in Data
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def include?(item)
    return false unless item != nil && item.category_ids.include?(@category)
    return false if $game_system.mamc_hide_ary.include?(item.id)
    $game_system.mamc_data_conditions_met?(MAMC_CONFIG[:show_entry_when], item.id)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Whether it should be drawn enabled
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def enable?(item)
    return false if item.nil?
    $game_system.mamc_data_conditions_met?(MAMC_CONFIG[:show_battler_when], item.id) ||
      $game_system.mamc_data_conditions_met?(MAMC_CONFIG[:show_data_when], item.id) 
  end
  alias show_name? enable?  
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Make Item List
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def make_item_list
    @data = $data_enemies.select {|item| include?(item) }
    case MAMC_CONFIG[:sort_by]
    when :alphabet
      @data.sort! { |a, b| a.name <=> b.name }
    when :encounter
      encounter_order = $game_system.mamc_encounter_ary.reverse
      encounter_order.each { |id|
        a = @data.delete($data_enemies[id])
        @data.unshift($data_enemies[id]) if a != nil
      }
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Item
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_item(index)
    item = @data[index]
    if item
      rect = item_rect_for_text(index)
      enable = enable?(item)
      change_color(normal_color, enable)
      draw_number(index, rect) unless !MAMC_CONFIG[:number_by] || MAMC_CONFIG[:number_by] == :none
      if show_name?(item)
        if MAMC_CONFIG[:show_monster_icon]
          draw_item_name(item, rect.x, rect.y, enable, rect.width)
        else
          draw_text(rect, item.name)
        end
      else
        if MAMC_CONFIG[:show_monster_icon]
          rect.x += 24 
          rect.width -= 24
        end
        draw_text(rect, sprintf(MAMC_CONFIG[:absent_monster_name], item.name))
      end
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Number
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_number(index, rect)
    num = case MAMC_CONFIG[:number_by]
    when :id then @data[index].id
    when :index then index + 1
    end
    string = sprintf(MAMC_CONFIG[:number_format], num)
    tw = contents.text_size(string).width
    draw_text(rect, string)
    rect.x += tw
    rect.width -= tw
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Refresh
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def refresh
    make_item_list
    create_contents
    draw_all_items
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Update Help
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def update_help
    @help_window.monster_id = item ? item.id : 0
  end
end

#==============================================================================
# ** Window_MonsterCard
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  This window shows data on a monster
#==============================================================================

class Window_MonsterCard < Window_Selectable
  include MAMC_WindowAdditions
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Public Instance Variables
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  attr_reader :monster_id
  attr_reader :monster
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Object Initialization
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def initialize(x, y, width, height)
    super(x, y, width, height)
    refresh(0)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Refresh
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def refresh(monster_id = @monster_id)
    monster_id = 0 if monster_id == nil
    if monster_id.is_a?(Game_Enemy)
      @monster = monster_id
      @monster_id = @monster.enemy.id
    else
      @monster_id = monster_id
      @monster = monster_id > 0 ? Game_Enemy.new(0, @monster_id) : nil
    end
    contents.clear
    reset_font_settings
    w = MAMC_CONFIG[:frame_width]
    if @monster_id > 0 && (show_battler? || MAMC_CONFIG[:silhouette])
      draw_battler(1 + w*2, 4 + w*4 + line_height, !show_battler?)
    end
    draw_frame
    draw_stats_label if show_data? && !shown_stats.empty?
    draw_name(6 + w*2, 2 + w*2) if @monster
    if show_data?
      # Draw Species
      draw_species(6 + w*2, 4 + w*4 + line_height)
      # Draw Stats
      draw_stats
    end
    update_help
  end
  alias monster_id= refresh
  alias monster= refresh
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Frame
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_frame
    w = MAMC_CONFIG[:frame_width]
    wdth = contents_width - 2 - w
    hght = contents_height - 2 - w
    draw_basic_frame(1 + w, 1 + w, wdth, hght, text_color(MAMC_CONFIG[:frame_shadow_colour]))
    draw_basic_frame(1, 1, wdth, hght, text_color(MAMC_CONFIG[:frame_colour]))
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Basic Frame
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_basic_frame(x, y, width, height, colour)
    w = MAMC_CONFIG[:frame_width]
    # Draw Horizontal Lines
    contents.fill_rect(x, y, width, w, colour)
    contents.fill_rect(x, y + line_height + (w + 1)*2, width, w, colour)
    contents.fill_rect(x, y + height - w, width, w, colour)
    # Draw Vertical Lines
    contents.fill_rect(x, y, w, height, colour)
    contents.fill_rect(x + width - w, y, w, height, colour)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Stat Divider
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_stat_divider(x, y, width, label_x, tw, colour)
    w = MAMC_CONFIG[:frame_width]
    contents.fill_rect(x, y, label_x - x, w, colour)
    contents.fill_rect(label_x + tw, y, width - ((label_x - x) + tw), w, colour)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Stats Label
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_stats_label
    w = MAMC_CONFIG[:frame_width]
    contents.font.bold = true
    stw = text_size(MAMC_CONFIG[:stats_label]).width + 8
    lx = 34
    y = stat_y + (line_height / 2)
    draw_stat_divider(1 + w, y + w, contents_width - 2 - 3*w, lx, stw, text_color(MAMC_CONFIG[:frame_shadow_colour]))
    draw_stat_divider(1, y, contents_width - 2 - w, lx, stw, text_color(MAMC_CONFIG[:frame_colour]))
    change_color(text_color(MAMC_CONFIG[:frame_colour]))
    draw_text(lx, stat_y, stw, line_height, MAMC_CONFIG[:stats_label], 1)
    reset_font_settings
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Monster Battler
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_battler(x, y, silhouette = false)
    bmp = setup_battler_graphic(x, y, silhouette)
    # Draw in two parts: full opacity and less opacity
    clear_hght = stat_y + (line_height / 2) - y
    src_rect = Rect.new(0, 0, bmp.rect.width, [clear_hght, bmp.rect.height].min)
    contents.blt(x, y, bmp, src_rect, MAMC_CONFIG[:battler_opacity])
    if bmp.rect.height > clear_hght
      src_rect.y = clear_hght
      src_rect.height = bmp.rect.height - clear_hght
      contents.blt(x, y + clear_hght, bmp, src_rect, MAMC_CONFIG[:battler_opacity_under_stats])
    end
    bmp.dispose
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Name
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_name(x, y)
    change_color(normal_color)
    draw_text(x, y, contents_width - 2*x, line_height, monster_name)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Species
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_species(x, y)
    return if monster.enemy.species_id < 1
    return if MAMC_CONFIG[:species][monster.enemy.species_id - 1].nil?
    icon_index, species_name = *MAMC_CONFIG[:species][monster.enemy.species_id - 1]
    draw_icon(icon_index, x, y)
    change_color(text_color(MAMC_CONFIG[:species_colour]))
    draw_text(x + 24, y, contents_width - x*2, line_height, species_name)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Stats
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_stats
    x = 6 + MAMC_CONFIG[:frame_width]*2
    y = stat_y + line_height
    width = ((contents_width - x*2) / 2) - 8
    stats = shown_stats
    for i in 0...stats.size
      draw_stat(x + ((i % 2)*(width + 16)), y + ((i / 2)*line_height), width, stats[i])
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Stat
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_stat(x, y, width, stat)
    stat_val = stat_value(stat)
    label = MAMC_CONFIG[:shown_stats][stat]
    stat_label = label.is_a?(Symbol) ? eval(label.to_s) : label
    tw = text_size(stat_val).width + 4
    change_color(system_color)
    draw_text(x, y, width - tw, line_height, stat_label)
    change_color(normal_color)
    draw_text(x, y, width, line_height, stat_val, 2)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Show Data?
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def show_data?(monster_id = @monster_id)
    return false unless monster_id.between?(1, $data_enemies.size - 1)
    $game_system.mamc_data_conditions_met?(MAMC_CONFIG[:show_data_when], monster_id)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Show Battler and Name?
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def show_battler?(monster_id = @monster_id)
    return false unless monster_id.between?(1, $data_enemies.size - 1)
    show_data?(monster_id) || $game_system.mamc_data_conditions_met?(MAMC_CONFIG[:show_battler_when], monster_id) 
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Get Battler Graphic
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def setup_battler_graphic(x, y, silhouette = false)
    bmp = get_battler(silhouette)
    # Maximum Parameters
    max_width = contents_width - 2*x
    max_height = contents_height - y - (1 + MAMC_CONFIG[:frame_width]*2)
    # Make dummy Bitmap
    rect = Rect.new(x, y, max_width, max_height)
    dest_rect, fits = battler_rect(bmp, rect)
    dummy_bmp = Bitmap.new(max_width, max_height)
    # Draw Battler
    if fits
      dummy_bmp.blt(dest_rect.x, dest_rect.y, bmp, bmp.rect)
    else
      src_rect = Rect.new((bmp.rect.width - dest_rect.width) / 2, 
        (bmp.rect.height - dest_rect.height) / 2, dest_rect.width, dest_rect.height)
      dummy_bmp.blt(dest_rect.x, dest_rect.y, bmp, src_rect)
    end
    dummy_bmp
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Get Battler
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def get_battler(silhouette = false)
    if silhouette
      if !monster.enemy.silhouette_battler.empty?
        begin
          return Cache.battler(*monster.enemy.silhouette_battler)
        rescue
          p "Error: Monster Catalogue\nSilhouette Battler set for Monster #{monster.id}: #{monster.name} does not exist."
        end
      end
      bmp_to_silhouette(Cache.battler(monster.battler_name, monster.battler_hue).dup)
    else
      Cache.battler(monster.battler_name, monster.battler_hue)
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Convert Bitmap to Silhouette
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def bmp_to_silhouette(bmp)
    colour = text_color(MAMC_CONFIG[:silhouette_colour])
    for i in 0...bmp.width
      for j in 0...bmp.height
        pa = bmp.get_pixel(i, j).alpha
        if pa != 0
          colour.alpha = pa
          bmp.set_pixel(i, j, colour) 
        end
      end
    end
    bmp
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Battler Rect
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def battler_rect(bmp, rect)
    # Get the size
    dest_rect = bmp.rect.dup
    # If need to stretch, find the correct proportion
    fits = dest_rect.width <= rect.width && dest_rect.height <= rect.height
    if !fits
      dest_rect.width = rect.width if dest_rect.width > rect.width
      dest_rect.height = rect.height if dest_rect.height > rect.height
    end
    # Centre Battler
    dest_rect.x = ((rect.width - dest_rect.width) / 2)
    if dest_rect.height < (stat_y - rect.y - 16)
      dest_rect.y = ((stat_y - rect.y - dest_rect.height) / 2)
    elsif dest_rect.height > ((rect.height*3) / 4)
      dest_rect.y = ((rect.height - dest_rect.height) / 2)
    else
      dest_rect.y = 8
    end
    return dest_rect, fits
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Showable Stats
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def shown_stats
    stats = (monster.nil? || !show_data?) ? [] : MAMC_CONFIG[:shown_stats].keys
    stats.keep_if { |stat| monster.class.method_defined?(stat) }
    stats
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Monster Name
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def monster_name
    (monster && (show_battler? || show_data?)) ? monster.enemy.name : 
      sprintf(MAMC_CONFIG[:absent_monster_name], monster.enemy.name)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Stat Value
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def stat_value(stat)
    if $imported[:MA_EnemyStatVariance]
      param_id = [:mhp, :mmp, :atk, :def, :mat, :mdf, :agi, :luk].index(stat)
      if param_id != nil
        stat_val = monster.enemy.params[param_id]
        plus = 0
        monster.enemy.maesv_add_params.each { |param_var|
          if param_var[0] == param_id
            if param_var[2]
              plus += ((param_var[1].to_f / 100.0)*(stat_val + plus)).to_i
            else
              plus += (param_var[1] - 1)
            end
          end
        }
        return "#{stat_val}-#{stat_val + plus}" if plus > 0
      end
    end
    stat_val = monster.send(stat)
    stat_val.is_a?(Float) ? "#{(stat_val*100).to_i}%" : stat_val.to_s
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Stat Y
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def stat_y
    y = contents_height - (1 + MAMC_CONFIG[:frame_width]*2)
    y -= (((shown_stats.size + 1) / 2) + 1)*line_height unless shown_stats.empty?
    y
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Update Help
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def update_help
    @help_window.set_item((monster && show_data?) ? monster.enemy : nil) if @help_window
  end
end

#==============================================================================
# *** MAMC Battle Monster Card
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  This module alters a couple of methods in Window_MonsterCard
#==============================================================================

module MAMC_BattleMonsterCard
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Draw Stat
  #    Change draw_stat method to draw gauge for HP and MP
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def draw_stat(x, y, width, stat)
    case stat
    when :mhp, :hp then draw_actor_hp(monster, x, y, width)
    when :mmp, :mp then draw_actor_mp(monster, x, y, width)
    else
      super(x, y, width, stat)
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Stat Value
  #    Change stat_value method to not show range if Enemy Stat Variance
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def stat_value(stat)
    stat_val = monster.send(stat)
    stat_val.is_a?(Float) ? "#{(stat_val*100).to_i}%" : stat_val.to_s
  end
end

#==============================================================================
# ** Scene_Battle
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    aliased methods - create_all_windows; invoke_item
#    new method - mamc_analyze_monster; create_monstercard_window; 
#      close_monstercard_window
#==============================================================================

class Scene_Battle
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create All Windows
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  alias mamc_createallwindows_2sj5 create_all_windows
  def create_all_windows(*args, &block)
    mamc_createallwindows_2sj5(*args, &block) # Call Original Methods
    create_monstercard_window
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create Monster Card Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def create_monstercard_window
    x = (Graphics.width - @status_window.width) / 2
    @monstercard_window = Window_MonsterCard.new(x, 0, @status_window.width, Graphics.height - @status_window.height)
    @monstercard_window.z = [@log_window.z + 1, 200].max
    @monstercard_window.openness = 0
    # Include the BattleMonsterCard module in the singleton class
    @monstercard_window.send(:extend, MAMC_BattleMonsterCard)
    @monstercard_window.set_handler(:cancel, lambda { close_monster_card_window })
    @monstercard_window.set_handler(:ok, lambda { close_monster_card_window })
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Analyze Monster
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def mamc_analyze_monster(target)
    target.mamc_analyze_now = false
    @monstercard_window.monster = target
    @monstercard_window.open
    @monstercard_window.activate
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Frame Update
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  alias mamc_update_3sk9 update
  def update(*args, &block)
    if @monstercard_window.active
      update_basic
    else
      $game_troop.members.each { |enemy| 
        if enemy.class.method_defined?(:mamc_analyze_now) && enemy.mamc_analyze_now
          mamc_analyze_monster(enemy)
          return
        end
      }
      mamc_update_3sk9(*args, &block) # Call Original Method
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Close Monster Card Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def close_monster_card_window
    $imported["YEA-BattleEngine"] ? @monstercard_window.openness = 0 : @monstercard_window.close
  end
end

#==============================================================================
# ** Scene_Map
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    aliased method - update_scene
#    new methods - update_call_monster_catalogue; call_monster_catalogue
#==============================================================================

class Scene_Map
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Update Scene
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  alias mamc_updatscen_2wh5 update_scene
  def update_scene(*args, &block)
    mamc_updatscen_2wh5(*args, &block)
    update_call_monster_catalogue unless scene_changing?
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Update Call Monster Catalogue
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def update_call_monster_catalogue
    if $game_map.interpreter.running?
      @monster_catalogue_calling = false
    else
      @monster_catalogue_calling ||= Input.trigger?(MAMC_CONFIG[:map_button])
      call_monster_catalogue if @monster_catalogue_calling && !$game_player.moving?
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Call Monster Catalogue
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def call_monster_catalogue
    @monster_catalogue_calling = false
    Sound.play_ok
    SceneManager.call(Scene_MonsterCatalogue)
  end
end if MAMC_CONFIG[:map_access]

# Menu Access
if !$imported[:MA_InsertCommand] && MAMC_CONFIG[:menu_access]
# Initialize the Insertion Hash
MA_COMMAND_INSERTS = {}
MA_InsertableMenuCommand = Struct.new(:name, :index, :enable, :scene, :other)

#==============================================================================
# ** Game_System
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    new public instance variable - maic_menu_commands
#    aliased method - initialize
#==============================================================================

class Game_System
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Inserted Menu Commands
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def maic_inserted_menu_commands
    # Lazy Instantiation so that old save files are not corrupted
    if !@maic_inserted_menu_commands
      @maic_inserted_menu_commands = MA_COMMAND_INSERTS.keys
      # Sort by index
      @maic_inserted_menu_commands.sort! { |a, b| MA_COMMAND_INSERTS[a].index <=> MA_COMMAND_INSERTS[b].index }
    end
    @maic_inserted_menu_commands
  end
end

#==============================================================================
# ** Window_MenuCommand
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    aliased method - make_command_list; maic_insert_command
#==============================================================================

class Window_MenuCommand
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Make Command List
  #``````````````````````````````````````````````````````````````````````````
  #  I alias this method instead of add_original_commands because I need to
  # have all commands created before I can insert at the correct index
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  alias maic_mkcmmndl_6yd2 make_command_list
  def make_command_list(*args, &block)
    maic_mkcmmndl_6yd2(*args, &block) # Run Original Method
    # Insert new commands
    $game_system.maic_inserted_menu_commands.each { |sym| maic_insert_command(sym) }
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Insert Command
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def maic_insert_command(symbol)
    command = MA_COMMAND_INSERTS[symbol]
    # Get the command name
    name = command.name.is_a?(Symbol) ? eval(command.name.to_s) : command.name
    # Check whether enabled
    enabled = case command.enable
    when Integer then command.enable == 0 ? true : $game_switches[command.enable]
    when String then eval(command.enable)
    when Symbol then self.send(command.enable)
    else
      enabled = true
    end
    # Add the command to the list
    add_command(name, symbol, enabled)
    added = @list.pop
    @list.insert([command.index, @list.size].min, added) # Insert at specific index
  end
end

#==============================================================================
# ** Scene_Menu
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  Summary of Changes:
#    aliased method - create_command_window; on_personal_ok
#    new methods - maic_set_insert_handler; maic_command_insert
#==============================================================================

class Scene_Menu
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create Command Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  alias maic_createcndwin_3ey7 create_command_window
  def create_command_window(*args, &block)
    maic_createcndwin_3ey7(*args, &block) # Run Original Method
    # Add handlers for all custom commands
    $game_system.maic_inserted_menu_commands.each { |symbol| maic_set_insert_handler(symbol) }
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Set Inserted Handler
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def maic_set_insert_handler(symbol)
    other = MA_COMMAND_INSERTS[symbol].other
    handler = case other
    when Symbol then method(other)
    when String then lambda { eval(other) }
    when TrueClass then method(:command_personal)
    else
      handler = method(:maic_command_insert)
    end
    @command_window.set_handler(symbol, handler)
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Custom Command
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def maic_command_insert
    SceneManager.call(Kernel.const_get(MA_COMMAND_INSERTS[@command_window.current_symbol].scene))
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Personal OK
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  alias maic_onpok_3ek9 on_personal_ok
  def on_personal_ok(*args, &block)
    if $game_system.maic_inserted_menu_commands.include?(@command_window.current_symbol)
      maic_command_insert
    else
      maic_onpok_3ek9(*args, &block) # Run Original Method
    end
  end
end

$imported[:MA_InsertCommand] = true
end

if MAMC_CONFIG[:menu_access]
  MA_COMMAND_INSERTS[:monster_catalogue] = MA_InsertableMenuCommand.new(MAMC_CONFIG[:menu_label], 
    MAMC_CONFIG[:menu_index], true, :Scene_MonsterCatalogue, false)
end

#==============================================================================
# ** Scene Monster Catalogue
#++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#  This processes the Monster Catalogue Scene
#==============================================================================

class Scene_MonsterCatalogue < Scene_MenuBase
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Start
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def start
    super
    beastiarycheck
    create_help_window
    create_categorylabel_window
    create_category_window
    create_monstercard_window
    create_monsterlist_window
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create Help Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def create_help_window
    if MAMC_CONFIG[:desc_window_lines] > 0
      @help_window = Window_Help.new(MAMC_CONFIG[:desc_window_lines])
      @help_window.send(:extend, MAMC_WindowAdditions)
      @help_window.windowskin = Cache.system(MAMC_CONFIG[:windowskin]) if MAMC_CONFIG[:windowskin]
      @help_window.reset_font_settings
      @help_window.y = Graphics.height - @help_window.height
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create Category Label Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def create_categorylabel_window
    @categorylabel_window = Window_MonsterCategoryLabel.new(0, 0)
    @categorylabel_window.category = MAMC_CONFIG[:shown_categories][0]
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create Category Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def create_category_window
    unless MAMC_CONFIG[:shown_categories].size < 2
      @category_window = Window_MonsterCategory.new(0, @categorylabel_window.height)
      @category_window.label_window = @categorylabel_window
    end
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create Monster Card
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def create_monstercard_window
    x = MAMC_CONFIG[:list_window_width]
    hght = @help_window ? @help_window.y : Graphics.height
    @monstercard_window = Window_MonsterCard.new(x, 0, Graphics.width - x, hght)
    @monstercard_window.set_handler(:cancel,   method(:return_scene))
    @monstercard_window.activate
    @monstercard_window.help_window = @help_window if @help_window
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Create Monster List Window
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  def create_monsterlist_window
    y = @category_window ? @category_window.y + @category_window.height : @categorylabel_window.height
    hght = @help_window ? @help_window.y - y : Graphics.height - y
    @monsterlist_window = Window_MonsterList.new(0, y, MAMC_CONFIG[:list_window_width], hght)
    @monsterlist_window.category = MAMC_CONFIG[:shown_categories][0]
    @monsterlist_window.help_window = @monstercard_window
    @category_window.monsterlist_window = @monsterlist_window if @category_window
  end
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  # * Check Switches
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ 
  def beastiarycheck
    # Holstaurus  ID:1
    if $game_switches[101]
     $game_system.mamc_encounter_monster(1)
    end
    # Honey Bee   ID:3
    if $game_switches[102]
      $game_system.mamc_encounter_monster(2)
      $game_system.mamc_encounter_monster(3)
    end
    # Hornet ID:4
    if $game_switches[103]
      $game_system.mamc_encounter_monster(4)
    end
    # Arachne ID:5
    if $game_switches[104]
      $game_system.mamc_encounter_monster(5)
    end
    # Mouse ID:6
    if $game_switches[105]
      $game_system.mamc_encounter_monster(6)
    end
    # Slime ID:7
    if $game_switches[106]
      $game_system.mamc_encounter_monster(7)
    end
    # Greenworm ID:91
    if $game_switches[164]
      $game_system.mamc_encounter_monster(91)
    end
    # Were-Cat ID:85
    if $game_switches[161]
      $game_system.mamc_encounter_monster(85)
    end
    # Giant Frog ID:90
    if $game_switches[163]
      $game_system.mamc_encounter_monster(90)
    end
    # Owl Mage ID:64
    if $game_switches[157]
      $game_system.mamc_encounter_monster(64)
    end 
    # Mermaid ID:8
    if $game_switches[107]
      $game_system.mamc_encounter_monster(8)
    end
    # Sea Bishop ID:10
    if $game_switches[108]
      $game_system.mamc_encounter_monster(10)
    end
    # Sea Slime ID:11
    if $game_switches[116]
      $game_system.mamc_encounter_monster(11)
    end
    # Crab Girl ID:76
    if $game_switches[158]
      $game_system.mamc_encounter_monster(76)
    end
    # Kappa ID:12
    if $game_switches[109]
      $game_system.mamc_encounter_monster(12)
    end
    # Sahagin ID:13
    if $game_switches[110]
      $game_system.mamc_encounter_monster(13)
    end
    # Nereid ID:14
    if $game_switches[111]
      $game_system.mamc_encounter_monster(14)
    end 
    # Sahaguin Raider Leader ID:88
    if $game_switches[162]
           $game_system.mamc_encounter_monster(86)
      $game_system.mamc_encounter_monster(87)
      $game_system.mamc_encounter_monster(88)
    end
    # Flow Kelp ID:89
    if $game_switches[160]
      $game_system.mamc_encounter_monster(89)
    end
    # Charybdis ID:15
    if $game_switches[112]
      $game_system.mamc_encounter_monster(15)
    end   
    # Scylla ID:16
    if $game_switches[113]
      $game_system.mamc_encounter_monster(16)
    end   
    # Kraken ID:17
    if $game_switches[114]
      $game_system.mamc_encounter_monster(17)
    end   
    # Siren ID:18
    if $game_switches[115]
      $game_system.mamc_encounter_monster(18)
    end  
    # Imp ID:19
    if $game_switches[117]
      $game_system.mamc_encounter_monster(19)
    end  
    # Arch Imp ID:20
    if $game_switches[118]
      $game_system.mamc_encounter_monster(20)
    end  
    # Lesser Succubus ID:21
    if $game_switches[119]
      $game_system.mamc_encounter_monster(21)
    end  
    # Amarya ID:22
    if $game_switches[120]
      $game_system.mamc_encounter_monster(63)
      $game_system.mamc_encounter_monster(65)
      $game_system.mamc_encounter_monster(66)
      $game_system.mamc_encounter_monster(67)
      $game_system.mamc_encounter_monster(68)
      $game_system.mamc_encounter_monster(69)
      $game_system.mamc_encounter_monster(70)
      $game_system.mamc_encounter_monster(71)
      $game_system.mamc_encounter_monster(22)
    end  
    # Roper ID:78
    if $game_switches[159]
      $game_system.mamc_encounter_monster(78)
    end  
    # Chastity ID:23
    if $game_switches[121]
      $game_system.mamc_encounter_monster(77)
      $game_system.mamc_encounter_monster(79)
      $game_system.mamc_encounter_monster(23)
    end  
    # Sonia ID:24
    if $game_switches[122]
      $game_system.mamc_encounter_monster(24)
    end  
    # Gaia ID:25
    if $game_switches[123]
      $game_system.mamc_encounter_monster(25)
    end  
    # Witch ID:26
    if $game_switches[124]
      $game_system.mamc_encounter_monster(26)
    end  
    # Baphomet ID:27
    if $game_switches[125]
      $game_system.mamc_encounter_monster(80)
      $game_system.mamc_encounter_monster(27)
    end  
    # Doppelganger ID:28
    if $game_switches[126]
      $game_system.mamc_encounter_monster(28)
    end  
    # Were-Bat ID:29
    if $game_switches[127]
      $game_system.mamc_encounter_monster(29)
    end  
    # Dhampir ID:30
    if $game_switches[128]
      $game_system.mamc_encounter_monster(30)
    end  
    # Draculara ID:31
    if $game_switches[129]
      $game_system.mamc_encounter_monster(31)
    end  
    # Dark Slime ID:32
    if $game_switches[130]
      $game_system.mamc_encounter_monster(32)
    end  
    # Mosquito ID:93
    if $game_switches[165]
      $game_system.mamc_encounter_monster(93)
    end  
    # Zombie ID:34
    if $game_switches[131]
      $game_system.mamc_encounter_monster(34)
    end 
    # Automaton M4E-V ID:116
    if $game_switches[168]
      $game_system.mamc_encounter_monster(113)
      $game_system.mamc_encounter_monster(114)
      $game_system.mamc_encounter_monster(115)
      $game_system.mamc_encounter_monster(116)
    end
    # Dullahan ID:35
    if $game_switches[132]
      $game_system.mamc_encounter_monster(35)
    end  
    # Gargoyle ID:36
    if $game_switches[133]
      $game_system.mamc_encounter_monster(36)
    end  
    # Mara (Lich) ID:38
    if $game_switches[134]
      $game_system.mamc_encounter_monster(117)
      $game_system.mamc_encounter_monster(37)
      $game_system.mamc_encounter_monster(38)
    end  
    # Parasite Slime ID:40
    if $game_switches[135]
      $game_system.mamc_encounter_monster(40)
    end  
    # Werewolf ID:41
    if $game_switches[136]
      $game_system.mamc_encounter_monster(122)
      $game_system.mamc_encounter_monster(41)
    end  
    # Mimic ID:42
    if $game_switches[137]
      $game_system.mamc_encounter_monster(42)
    end  
    # Ghost ID:43
    if $game_switches[138]
      $game_system.mamc_encounter_monster(43)
    end 
    # Living Doll ID:44
    if $game_switches[139]
      $game_system.mamc_encounter_monster(44)
    end 
    # Ghoul ID:45
    if $game_switches[140]
      $game_system.mamc_encounter_monster(45)
    end 
    # Collared Wolf 2 ID:178
    if $game_switches[154]
      $game_system.mamc_encounter_monster(177)
      $game_system.mamc_encounter_monster(178)
    end 
    # Gremlin ID:174
    if $game_switches[154]
      $game_system.mamc_encounter_monster(174)
    end 
    # Alpha Wolf ID:176
    if $game_switches[169]
      $game_system.mamc_encounter_monster(176)
    end 
    # Ratfolk ID:191
    if $game_switches[170]
      $game_system.mamc_encounter_monster(189)
      $game_system.mamc_encounter_monster(190)
      $game_system.mamc_encounter_monster(191)
    end 
    # Sphinx ID:46
    if $game_switches[141]
      $game_system.mamc_encounter_monster(46)
    end 
    # Mummy ID:47
    if $game_switches[142]
      $game_system.mamc_encounter_monster(47)
    end 
    # Anubis ID:48
    if $game_switches[143]
      $game_system.mamc_encounter_monster(48)
    end 
    # Pot Devil ID:142
    if $game_switches[152]
      $game_system.mamc_encounter_monster(142)
    end 
    # Pharaoh ID:140
    if $game_switches[144]
      $game_system.mamc_encounter_monster(130)
      $game_system.mamc_encounter_monster(131)
      $game_system.mamc_encounter_monster(134)
      $game_system.mamc_encounter_monster(135)
      $game_system.mamc_encounter_monster(138)
      $game_system.mamc_encounter_monster(139)
      $game_system.mamc_encounter_monster(140)
    end 
    # Lizardwoman ID:50
    if $game_switches[145]
      $game_system.mamc_encounter_monster(50)
    end 
    # Devil Bug ID:51
    if $game_switches[146]
      $game_system.mamc_encounter_monster(51)
    end 
    # Echidna ID:55
    if $game_switches[147]
      $game_system.mamc_encounter_monster(55)
    end 
    # Ant Arachne ID:53
    if $game_switches[148]
      $game_system.mamc_encounter_monster(54)
    end 
    # Sandwurm ID:56
    if $game_switches[149]
      $game_system.mamc_encounter_monster(56)
    end 
    # Manticore ID:58
    if $game_switches[150]
      $game_system.mamc_encounter_monster(58)
    end 
    # Manticore ID:132
    if $game_switches[151]
      $game_system.mamc_encounter_monster(132)
    end 
    # Goblin ID:61
    if $game_switches[156]
      $game_system.mamc_encounter_monster(61)
    end 
    # Elven Trio ID:96
    if $game_switches[180]
      $game_system.mamc_encounter_monster(94)
      $game_system.mamc_encounter_monster(95)
      $game_system.mamc_encounter_monster(96)
    end 
    # Tanuki Merchant ID:99
    if $game_switches[166]
      $game_system.mamc_encounter_monster(98)
      $game_system.mamc_encounter_monster(99)
    end 
    # Harpy ID:100
    if $game_switches[167]
      $game_system.mamc_encounter_monster(100)
      $game_system.mamc_encounter_monster(101)
    end 
    # Suzume ID:127
    if $game_switches[178]
      $game_system.mamc_encounter_monster(127)
    end 
    # Suzume (Succubus) ID:174
    if $game_switches[179]
      $game_system.mamc_encounter_monster(174)
    end 
    # Living Statue ID:170
    if $game_switches[173]
      $game_system.mamc_encounter_monster(170)
    end 
    # Celini ID:173
    if $game_switches[174]
      $game_system.mamc_encounter_monster(171)
      $game_system.mamc_encounter_monster(172)
      $game_system.mamc_encounter_monster(173)
    end 
    # Ochimusha ID:156
    if $game_switches[171]
      $game_system.mamc_encounter_monster(156)
    end 
    # Kamaitachi ID:159
    if $game_switches[172]
      $game_system.mamc_encounter_monster(157)
      $game_system.mamc_encounter_monster(158)
      $game_system.mamc_encounter_monster(159)
    end 
    # Kitsune ID:162
    if $game_switches[175]
      $game_system.mamc_encounter_monster(162)
    end 
    # Kejourou ID:166
    if $game_switches[176]
      $game_system.mamc_encounter_monster(166)
    end 
    # Otohime ID:167
    if $game_switches[177]
      $game_system.mamc_encounter_monster(167)
    end 
  end
end