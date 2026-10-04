#+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
# ■ Window_MapName Plus+
# ■ Author: Bigace360   
# ■ Version: 1.0
# ■ Date: April 26, 2012
#+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
# v1.0 (4.26.2012) ● Original script completed
#+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+

module ACE
	module MAPNAME
		NAME_ALIGN = 1
		FONT_SIZE = 24
		FONT_TYPE = 'VL Gothic'
	end
end	

class Window_MapName < Window_Base
	include ACE::MAPNAME
	def initialize
		super(0, 0, Graphics.width / 2, fitting_height(1))
		self.opacity, self.contents_opacity, @show_count = 0, 0, 0
		self.contents.font.size, self.contents.font.name = FONT_SIZE, FONT_TYPE
		refresh
	end
	def update_fadein
		self.opacity += 32 unless $game_map.display_name.empty?
		self.contents_opacity += 16
	end
	def update_fadeout
		self.opacity -= 16 unless $game_map.display_name.empty?
		self.contents_opacity -= 16
	end
	def refresh
		contents.clear
		return if $game_map.display_name.empty?
		draw_text(contents.rect, $game_map.display_name, NAME_ALIGN)
	end
end