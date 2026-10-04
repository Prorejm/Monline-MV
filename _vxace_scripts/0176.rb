=begin
================================================================================
 ** Custom Database
 Author: Hime
 Date: Dec 25, 2013
--------------------------------------------------------------------------------
 ** Change log
 2.2 Dec 25, 2013
   -fixed bug during save file loading
 2.1 Jan 25, 2013
   -fixed bug in logic preventing items from being merged properly
   -Added support for updating database objects
   -Changed the internal structure for custom data from an array to a hash
 2.0 Jan 18, 2013
   -Provided more standardized methods for working with the database.
 1.0 May 18, 2012
   -Initial release
--------------------------------------------------------------------------------
 * Description
 
 This script provides the functionality for saving and loading custom
 data to save files.
--------------------------------------------------------------------------------
 * Usage
 
 --Creating objects--
 
 To create a new database object, begin by creating the appropriate RPG object.
 For example, suppose we wanted to create a new weapon.
 
    w = RPG::Weapon.new
    w.wtype_id = 1
    w.name = "Example Blade"
    w.params = [100, 10, 5, 0, 0, 0, 0, 0]
    
 When the object is created, call the appropriate method provided in CustomData
 module. In this case, since we are adding a new weapon to the game, we would
 call the `add_weapon` method
 
    id = CustomData.add_weapon(w)
    
 All `add` methods return an ID, which represents the database ID that is
 assigned to the object.
 
 --Updating objects--
 
 To update an existing database object, you simply need to grab the object
 you want to update, make your changes, and then call the appropriate update
 method. For example, suppose we wanted to update weapon 4 to make it stronger:
 
    w = $data_weapons[4]
    w.params[2] += 50
    CustomData.update_weapon(w)
    
 The update method will return true if the operation was successful, and
 false otherwise.
 
 --Deleting objects--
 
 Typically, you should not be deleting any objects in the database because
 you may have references to them in other objects. This is due to the design
 of the database. I have not provided any way for you to delete objects at
 the moment.
================================================================================
=end
$imported = {} if $imported.nil?
$imported["Tsuki_CustomDatabase"] = true

#-------------------------------------------------------------------------------
# This module provides standard methods for working with the database. You 
# should avoid accessing the database yourself; instead, use the provided
# methods to create new objects.
#-------------------------------------------------------------------------------

module CustomData
  
  def self.add_object(customset, dataset, obj)
    id = dataset.size
    obj.id = id
    customset[id] = obj
    dataset << obj
    return id
  end
  
  #-----------------------------------------------------------------------------
  # * Update the object in the database and custom database
  #-----------------------------------------------------------------------------
  def self.update_object(customset, dataset, obj)
    id = obj.id
    customset[id] = obj
    dataset[id] = obj
    return true
  end
  
  #-----------------------------------------------------------------------------
  # * Convenience methods for adding data
  #-----------------------------------------------------------------------------
  
  def self.add_actor(obj)
    add_object($custom_actors, $data_actors, obj)
  end
  
  def self.add_class(obj)
    add_object($custom_classes, $data_classes, obj)
  end
  
  def self.add_skill(obj)
    add_object($custom_skills, $data_skills, obj)
  end
  
  def self.add_item(obj)
    add_object($custom_items, $data_items, obj)
  end
  
  def self.add_weapon(obj)
    add_object($custom_weapons, $data_weapons, obj)
  end
  
  def self.add_armor(obj)
    add_object($custom_armors, $data_armors, obj)
  end
  
  def self.add_enemy(obj)
    add_object($custom_enemies, $data_enemies, obj)
  end
  
  def self.add_state(obj)
    add_object($custom_states, $data_states, obj)
  end
  
  def self.add_troop(obj)
    add_object($custom_troops, $data_troops, obj)
  end
  
  #-----------------------------------------------------------------------------
  # * Convenience methods for updating data
  #-----------------------------------------------------------------------------
  def self.update_actor(obj)
    update_object($custom_actors, $data_actors, obj)
  end
  
  def self.update_class(obj)
    update_object($custom_classes, $data_classes, obj)
  end
  
  def self.update_skill(obj)
    update_object($custom_skills, $data_skills, obj)
  end
  
  def self.update_item(obj)
    update_object($custom_items, $data_items, obj)
  end
  
  def self.update_weapon(obj)
    update_object($custom_weapons, $data_weapons, obj)
  end
  
  def self.update_armor(obj)
    update_object($custom_armors, $data_armors, obj)
  end
  
  def self.update_enemy(obj)
    update_object($custom_enemies, $data_enemies, obj)
  end
  
  def self.update_state(obj)
    update_object($custom_states, $data_states, obj)
  end
  
  def self.update_troop(obj)
    update_object($custom_troops, $data_troops, obj)
  end
end

module DataManager
  
  class << self
    alias :custom_data_load_normal_database :load_normal_database
    alias :custom_data_make_save_contents :make_save_contents
    alias :custom_data_extract_save_contents :extract_save_contents
  end
  
  #--------------------------------------------------------------------------
  # * Aliased. Initialize custom data
  #--------------------------------------------------------------------------
  def self.load_normal_database
    custom_data_load_normal_database
    load_custom_database
  end
  
  #--------------------------------------------------------------------------
  # * New. Initialize custom data
  #--------------------------------------------------------------------------
  def self.load_custom_database
    $custom_actors         = {} if $custom_actors.nil?
    $custom_classes        = {} if $custom_classes.nil?
    $custom_skills         = {} if $custom_skills.nil?    
    $custom_items          = {} if $custom_items.nil?
    $custom_weapons        = {} if $custom_weapons.nil?
    $custom_armors         = {} if $custom_armors.nil?
    $custom_enemies        = {} if $custom_enemies.nil?
    $custom_troops         = {} if $custom_troops.nil?
    $custom_states         = {} if $custom_states.nil?
    $custom_animations     = {} if $custom_animations.nil?
    $custom_tilesets       = {} if $custom_tilesets.nil?
    $custom_common_events  = {} if $custom_common_events.nil? 
    $custom_mapinfos       = {} if $custom_mapinfos.nil?
    $custom_system  = RPG::System.new if $custom_system.nil?
  end
  
  #--------------------------------------------------------------------------
  # * Aliased. Merge custom data with game data when saving
  #--------------------------------------------------------------------------
  def self.make_save_contents
    contents = custom_data_make_save_contents
    contents = contents.merge(make_custom_contents)
    contents
  end
  
  #--------------------------------------------------------------------------
  # * New. Save custom data
  #--------------------------------------------------------------------------
  def self.make_custom_contents
    contents = {}
    contents[:custom_actors]	      =	$custom_actors
    contents[:custom_classes]	      =	$custom_classes 
    contents[:custom_skills]	      =	$custom_skills
    contents[:custom_items]	        =	$custom_items 
    contents[:custom_weapons]	      =	$custom_weapons 
    contents[:custom_armors]	      =	$custom_armors
    contents[:custom_enemies]	      =	$custom_enemies
    contents[:custom_troops]	      =	$custom_troops
    contents[:custom_states]	      =	$custom_states
    contents[:custom_animations]	  =	$custom_animations
    contents[:custom_tilesets]	    =	$custom_tilesets
    contents[:custom_common_events]	=	$custom_common_events
    contents[:custom_system]        = $custom_system
    contents[:custom_mapinfos]	    =	$custom_mapinfos
    contents
  end
  
  #--------------------------------------------------------------------------
  # * Alias. Modified data load from save file to extract custom data
  #--------------------------------------------------------------------------
  def self.extract_save_contents(contents)
    custom_data_extract_save_contents(contents)
    extract_custom_contents(contents)
    merge_custom_contents
  end
  
  #--------------------------------------------------------------------------
  # * New. Load custom data
  #--------------------------------------------------------------------------
  def self.extract_custom_contents(contents)
    $custom_actors	       = contents[:custom_actors] || {}
    $custom_classes        = contents[:custom_classes] || {}
    $custom_skills         = contents[:custom_skills] || {}
    $custom_items          = contents[:custom_items] || {}
    $custom_weapons        = contents[:custom_weapons] || {}
    $custom_armors         = contents[:custom_armors] || {}
    $custom_enemies	       = contents[:custom_enemies] || {}
    $custom_troops         = contents[:custom_troops] || {}
    $custom_states         = contents[:custom_states] || {}
    $custom_animations     = contents[:custom_animations] || {}
    $custom_tilesets       = contents[:custom_tilesets] || {}
    $custom_common_events  = contents[:custom_common_events] || {}
    $custom_system         = contents[:custom_system] || {}
    $custom_mapinfos       = contents[:custom_mapinfos] || {}
  end
  
  #--------------------------------------------------------------------------
  # * New. Merge data with global arrays
  #--------------------------------------------------------------------------
  def self.merge_array_data(arr, hash)
    hash.each {|i, val|
      arr[i] = val
    }
  end
  
  #--------------------------------------------------------------------------
  # * New. Merge custom data with default database data
  #--------------------------------------------------------------------------
  def self.merge_custom_contents
    merge_array_data($data_actors, $custom_actors)
    merge_array_data($data_classes, $custom_classes)
    merge_array_data($data_skills, $custom_skills)
    merge_array_data($data_items, $custom_items)
    merge_array_data($data_weapons, $custom_weapons)
    merge_array_data($data_armors, $custom_armors)
    merge_array_data($data_enemies, $custom_enemies)
    merge_array_data($data_troops, $custom_troops)
    merge_array_data($data_states, $custom_states)
    merge_array_data($data_animations, $custom_animations)
    merge_array_data($data_tilesets, $custom_tilesets)
    merge_array_data($data_common_events, $custom_common_events)
    $data_mapinfos.merge       ($custom_mapinfos)
  end
end