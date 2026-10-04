#══════════════════════════════════════════════════════════════════════════
#  ▼ Nova::Encyclopedia
#  Autor: Alisson
#  Versão: 2.1
#  Data: 27/10/2016
#══════════════════════════════════════════════════════════════════════════

#--------------------------------------------------------------------------
#  ▼ Histórico
#--------------------------------------------------------------------------
# v2.1. Bug de listas longas corrigido. Resto dos bugs eliminados, mwahaha!
# v2.0. Grande update. Código refeito, área configurável remodelada.
# v1.3. Seleção de Categorias adicionada. Instruções atualizadas. 
# v1.2. Compatibilidade com resoluções maiores. Liberado.
# v1.0. Limpeza de código.
# v0.5. Correção de bugs.
# v0.1. Criado.
#--------------------------------------------------------------------------
# ▼ Termos de Uso
#--------------------------------------------------------------------------
# Livre para uso comercial. Ficaria agradecido se entrasse em contato
# comigo para avisar.
# Você pode alterar este sistema para uso próprio.
# Você não pode postar o sistema diretamente em outro lugar.
# Caso poste, redirecione o usuário para o tópico original do sistema.
# Créditos não são necessários, mas seriam apreciados.
#
# Para mais informações: centrorpg.com
#--------------------------------------------------------------------------
# ▼ Introdução
#--------------------------------------------------------------------------
# Nova - Encyclopedia is an encyclopedia system based on Nepedia,
# originally made for the game Megadimension Neptunia VII.
# It allows you to create an encyclopedia for your game.
# If you want to create a game manual, feel free.
# If you want to create a book collection, feel free.
# If you even want to make a quest system, you can. Use creativity.
# Make your encyclopedia.
#--------------------------------------------------------------------------
# ▼ Instruções
#--------------------------------------------------------------------------
# The script has detailed configuration instructions just below.
# Adding categories and adding topics are at the ends of
# settings.
# To call the encyclopedia menu, just use:
# SceneManager.call(Encyclopedia)
#══════════════════════════════════════════════════════════════════════════

module Nova
  module Encyclopedia
    #══════════════════════════════════════════════════════════════════════════
    # ■ - Configuração do Sistema -
    #══════════════════════════════════════════════════════════════════════════
    # Aqui ficam todas as configurações do script.
    #══════════════════════════════════════════════════════════════════════════

    #══════════════════════════════════════════════════════════════════════════
    # - Janela de Ajuda. -
    # É a janela que exibe o texto de ajuda na parte inferior.
    #══════════════════════════════════════════════════════════════════════════
    Help = {
                    # Texto que será mostrado durante a seleção de categorias.
                    :category_vocab => 'Select a Category.',
                    
                    # Texto que será mostrado durante a seleção de tópicos.
                    :topics_vocab => 'Select a Topic',
                    
                    # Windowskin da janela de ajuda.
                    :windowskin => 'Window',
                    
                    # Deseja usar uma imagem no lugar de uma window para a janela?
                    :image? => false,
                    
                    # Pasta em que ele irá procurar a imagem.
                    :folder => 'Graphics/Encyclopedia/',
                    
                    # Nome da imagem na pasta configurada acima.
                    :name => 'Background',
                    
                    # If you want to change the position of the image on the screen, use this:
                    :img_ox => 0,   # Posição horizontal.
                    :img_oy => 0,  # Posição vertical.
                    
    } # <= Não deletar.
    
    #══════════════════════════════════════════════════════════════════════════
    # - Comando no Menu. -
    # Aqui você configura se quer ou não adicionar a enciclopédia no menu.
    #══════════════════════════════════════════════════════════════════════════
    Command_in_Menu = {
                    # Ativar?
                    :enable? => false,
                    
                    # Switch necessário para que o jogador possa acessar a opção.
                    # Deixe 0 se quiser que ele sempre possa acessar.
                    :switch => 1,
                    
                    # Nome da opção no menu.
                    :name => 'PXEpedia',
                    
    } # <= Não deletar.
    
    #══════════════════════════════════════════════════════════════════════════
    # - Janela de Categorias. -
    # Aqui você configura a janela onde as categorias são mostradas.
    #══════════════════════════════════════════════════════════════════════════
    Category_Main = {
                    # Windowskin da janela.
                    :windowskin => 'Window',
                    
                    # Deseja usar uma imagem no lugar da janela?
                    :image? => false,
                    
                    # Pasta onde ele irá procurar a imagem.
                    :folder => 'Graphics/Encyclopedia/',
                    
                    # Nome da imagem na pasta configurada acima.
                    :name => 'Command Box',
                    
                    # Se você quiser alterar a posição da imagem na tela, use isso:
                    :img_ox => 0, # Posição horizontal.
                    :img_oy => 0, # Posição vertical.
                    
    } # <= Não deletar.
    
    #══════════════════════════════════════════════════════════════════════════
    # - Janela de Tópicos. -
    # Here you configure the window where topics are shown.
    #══════════════════════════════════════════════════════════════════════════
    Topics_Main = {
                    # Windowskin da janela.
                    :windowskin => 'Window',
                    
                    # Deseja usar uma imagem no lugar da janela?
                    :image? => false,
                    
                    # Pasta onde ele irá procurar a imagem.
                    :folder => 'Graphics/Encyclopedia/',
                    
                    # Nome da imagem na pasta configurada acima.
                    :name => 'Command Box',
                    
                    # Se você quiser alterar a posição da imagem na tela, use isso:
                    :img_ox => 0, # Posição horizontal.
                    :img_oy => 0, # Posição vertical.
                    
    } # <= Não deletar.
    
    #══════════════════════════════════════════════════════════════════════════
    # - Janela de Informação. -
    # Aqui você configura a janela onde a informação dos tópicos são mostrados.
    #══════════════════════════════════════════════════════════════════════════
    Info_Main = {
                    # Font Name
                    :font_name => 'Lato',
                    
                    # Font Size
                    :font_size => 14,
                    
                    # Outline Font?
                    :font_outline => false,
                    
                    # Colour of Font.
                    :font_color => Color.new(255, 255, 255, 255),
                    
                    # Windowskin to use.
                    :windowskin => 'Window',
                    
                    # Use an image in place of the window?
                    :image? => false,
                    
                    # Folder where it will look for the image.
                    :folder => 'Graphics/Encyclopedia/',
                    
                    # Image name in the folder configured above.
                    :name => 'Info Box',
                    
                    # If you want to change the position of the image on the screen, use this:
                    :img_ox => 0, # Posição horizontal.
                    :img_oy => 0, # Posição vertical.
                    
    } # <= Não deletar.
    
    #══════════════════════════════════════════════════════════════════════════
    # - Fundo. -
    # Here you can configure an image to use as a background.
    #══════════════════════════════════════════════════════════════════════════
    Background = {
                    # Ativar uma imagem para o fundo?
                    :enable? => false,
                    
                    # Pasta onde deverá ficar a imagem.
                    :folder => 'Graphics/Encyclopedia/',
                    
                    # Nome da imagem na pasta configurada acima.
                    :name => 'Background',
                    
                    # Deseja esticar o fundo para preencher a tela?
                    :scale_to_fit? => true,
                    
    } # <= Não deletar.
    
    #══════════════════════════════════════════════════════════════════════════
    # - Partículas. -
    # Aqui você pode configurar as partículas.
    #══════════════════════════════════════════════════════════════════════════
    Particles = {
                    # Deseja ativar as partículas?
                    :enable? => false,
                    
                    # Pasta onde deverão ficar as partículas.
                    :folder => 'Graphics/Weather/',
                    
                    # Nome das partículas. Pode inserir quantas quiser, mas
                    # lembrando que todas elas serão mostradas juntas.
                    :name => ['Light_01A', 'Light_02A'],
                    
                    # Quantidade de partículas na tela. Cuidado com o lag.
                    :amount => 60,
                    
                    # Se quiser configurar as animações das partículas,
                    # configure aqui.
                    :animation => {
                                    # Movimento das partículas.
                                    # Nota: Se você colocar up e down ao mesmo tempo, elas não se moverão.
                                    #       O mesmo serve para o left e right. Escolha ou um ou outro.
                                    :up => true,        # Mover pra cima?
                                    :right => true,     # Mover pra direita?
                                    :left => false,     # Mover pra esquerda?
                                    :down => false,     # Mover pra baixo?
                                    
                                    # Velocidade das partículas.
                                    
                                    # Velocidade vertical.
                                    :speed1_min => 1, # Velocidade mínima.
                                    :speed1_max => 4, # Velocidade máxima.
                                    
                                    # Velocidade horizontal.
                                    :speed2_min => 1, # Velocidade mínima.
                                    :speed2_max => 2, # Velocidade máxima.
                                    
                    }, # <= Não deletar.
    } # <= Muito menos isso.
    
    #══════════════════════════════════════════════════════════════════════════
    # ■ - Adição de Categorias -
    #══════════════════════════════════════════════════════════════════════════
    # Aqui você pode adicionar as categorias.
    # Veja os exemplos abaixo e adicione as suas da mesma forma.
    #══════════════════════════════════════════════════════════════════════════
    Categories = {
                  "Story Summary" => {
                                  :symbol => :story,
                                  :switch_id => 0,
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Categories/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 8867,
                  },
                  "Places" => {
                                  :symbol => :places,
                                  :switch_id => 0,
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Categories/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 8866,
                  },
                  "People" => {
                                  :symbol => :people,
                                  :switch_id => 0,
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Categories/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 8865,
                  },
                  "States" => {
                                  :symbol => :states,
                                  :switch_id => 0,
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Categories/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 8868,
                  },
                  "Tips" => {
                                  :symbol => :tips,
                                  :switch_id => 0,
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Categories/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 8869,
                  },
    } # <= Não deletar.
    
    #══════════════════════════════════════════════════════════════════════════
    # ■ - Adição de Tópicos -
    #══════════════════════════════════════════════════════════════════════════
    # Aqui você pode adicionar os tópicos.
    # Veja os exemplos abaixo e adicione os seus da mesma forma.
    #══════════════════════════════════════════════════════════════════════════
    Topics = {
                #---------------------------------------------------------------
                #    Story Summary
                #---------------------------------------------------------------                
                "The Forest Zone" => {
                                  :switch_id => 1441,
                                  :category => :story,
                                  :info => "It was supposed to just be a fun adventure in a new VR MMO, \nyou were excited to join the beta test just like everyone else. \nThen this madman in a hood shows up and traps everyone here \nto be victims in their game. You weren't alone though. You met a guy \nnamed Mark, and after saving each other you decided to \ntravel together, joined by your AI companion 'PXE'.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Breachwoods',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                "The Coastal Zone" => {
                                  :switch_id => 1442,
                                  :category => :story,
                                  :info => "You, Mark and PXE pooled together the information you knew and \nlooked around for clues. Through trials and tribulations \nyou collected the items needed for a ritual which brought you to \nthe Sea Goddess' bishop. After a battle with her, you obtained a \ntreasure of the zone, and came to the conclusion each zone \nmust have a similar treasure. You and Mark went seperate ways \nto search for these treasures and you ran into a woman named \nAlaru. After helping her save a town from monsters, \nshe joined your party and offered to guide you to the next zone.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Eurus Sea',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                "The Demon Zone" => {
                                  :switch_id => 1443,
                                  :category => :story,
                                  :info => "With Alaru in tow you reached the Demon Zone, but a mysterious \nmagic seperated your group and left you alone in a city \ncontrolled by demons. A friendly doppelganger there even helped you \nunlock a new power, to steal the abilities of your foes. Using this \nnew power you fought back against the demons and their \nleader, Alaru's sister Amarya. With Amarya defeated Alaru \nasked for your assistance, taking down her vampire mother. \nAfter avoiding a strange, gun-toting biker, the two of you \nreached the vampire's castle and took her down.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Elysium City',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                "The Desolate Zone" => {
                                  :switch_id => 1444,
                                  :category => :story,
                                  :info => "Alaru stayed behind to watch over her family and you entered \nthe Desolate Zone with only PXE at your side. She was quickly \nstripped away by Robin, as she had grown beyond her AI constraints. \nWith only a glitching AI at your side you continued on. You were \neven bit by a zombie, and travelled alongside another \nplayer named Kim to search for a cure. The biker showed up \nagain, causing chaos as she went. Eventually you reached a \nmansion, with a hacker-turned scientist within. She had to be \nput down after going to far with her experiments however.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Mansion Approach',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                "The Desert Zone" => {
                                  :switch_id => 1445,
                                  :category => :story,
                                  :info => "You reached the burning sands of the Desert alongside Kim and \nencountered other adventurers, Dominic and Fera, also intent on \nfinding the zone treasure. Goals aligned, you teamed up and together \nuncovered a great pyramid. Dominic stormed forward without \nyou and got himself possessed by an ancient spirit who \ncaptured the rest of you. With the help of a ghostly goddess \nyou managed to break free, rescue your allies, and defeat \nthe new pharaoh. She cursed you as she died, but all was well \nin the end and a repentant Domninic even joined the party.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Western Dunes',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                "Back to the City" => {
                                  :switch_id => 1446,
                                  :category => :story,
                                  :info => "Looking for a way to remove the pharaoh's curse so you could \nleave the desert the goddess Isis pointed you towards her daughter \nBastet. She would remove the curse for a price, and you headed \nback to the Desolate Zone to retieve a magic collar. The city \nwas beset by wolves under the control of the biker Lina. \nYou and Kim took down a hacker creating more collars and \nproceeded to chase down Lina herself. Your bikes crashed and \nshe had you at gunpoint, but Kim somehow managed to reflect \nthe shot and defeat the biker.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Barricade Turf',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                "The Mythic Zone" => {
                                  :switch_id => 1447,
                                  :category => :story,
                                  :info => "Your party recieved an invitation to a royal ball when you \nentered the Mythic Zone which you accepted. The invitation was from \nthe King himself, begging you to find his missing daughter. \nAt the same time you realised Fera had been kidnapped. Intent \non saving both you ventured out, falling prey to a trap \nthat left you stuck in the princess' body for a while and \ngetting tricked by Robin into believing Fera was actually in \ndanger from shrine maidens. The princess was saved, and \nFera embraced a new purpose as a guardian.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Mirane',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                "The Mythic Zone" => { #Part 2 (PXE Saved)
                                  :switch_id => 1448,
                                  :category => :story,
                                  :info => "There was one more thing to do in the Mythic Zone. Help PXE. \nStill glitching from Robin's attack the only way to help her was \nfinding the other fae. This quest lead you in to the woods and to \na strange realm called The Gleaming. There you collected \n'letters of introduction' from the rulers there to meet Queen Titania. \nTitania was actually a computer program in charge of creating \nPXEs for Robin and captured you all. Your own mind glitching, you \nmanaged to rescue the others and even restore PXE to normal, \nfighting back against Titania and escaping the realm.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Mirane',
                                  :icon? => true,
                                  :icon_index => 8867,
                },
                #---------------------------------------------------------------
                #    Places
                #---------------------------------------------------------------                
                "The Breachwoods" => {
                                  :switch_id => 1402,
                                  :category => :places,
                                  :info => "The Breachwoods encompase the entirety of the Forest Zone, \nfeaturing many interesting locations like cave systems and rivers. \nHumans also make their home in the forest as seen by the northern \nBreachwood Village and Caste City to the south. Some ranchers \nhave also been known to turn clearings into areas for livestock.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Breachwoods',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Caste City" => {
                                  :switch_id => 1403,
                                  :category => :places,
                                  :info => "Stuck between the Breachwood Forest and the ocean beyond, this \nhuman city boasts walls of high stone, strong enough to withstand \nany monster's attack. But all walls crumble eventually.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Caste City',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Eurum City" => {
                                  :switch_id => 1404,
                                  :category => :places,
                                  :info => "Rather small for a city, this quaint tropical paradise lies on the \nedge of the Eurus Sea. The north road takes you up to the Budan \nRiver, while the east heads toward the forest zone. Like most places \nby the sea, the local trade is fishing.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Eurum City',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Eurus Sea" => {
                                  :switch_id => 1405,
                                  :category => :places,
                                  :info => "This vast sea is enclosed by sharp, deadly rocks. It is said this is \nthe reason for it's high concentration of deadly monsters, many \ncreatures make their homes here from the peaceful Sea Slimes to \nthe deadly Mershark. Supposedly the entire sea is protected \nby a goddess.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Eurus Sea',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Budan River" => {
                                  :switch_id => 1406,
                                  :category => :places,
                                  :info => "A wide, gentle river that splits the Coastal Zone in half, the \nBudan is home to many different races. From the humans living the \nisland village to the sahaguin's hiding out in the caves and the \nupper banks. Unlike the nearby city of Eurum, or the island of \nDirian, the humans living on the Budan don't believe in the Sea \nGoddess, perhaps because of their frequent clashes with their \nmonstrous neighbours.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Budan River',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Elysium City" => {
                                  :switch_id => 1407,
                                  :category => :places,
                                  :info => "Nestled within a decaying forest and surrounded by thick \nimpenetrable walls lies the city of Elysium, named for the ancient \ntale of a blessed plain, this was once a place of beauty and \nhappiness but with corruption seeping into the roots the town is \nnow nothing but a shell of it's former self. Dark work goes on \nbehind closed doors and evil sets in motion plans for the innocent \ncivilians that call it home. In the center of the sickly river lies \nthe shining beacon of Elysium, it's great cathedral.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Elysium City',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Hilltop Castle" => {
                                  :switch_id => 1408,
                                  :category => :places,
                                  :info => "From the dark sewers to the tallest tower, this castle is one \nimposing structure. Owned long ago by a human noble, the castle is \nnow the home of the Vampire Queen Draculara and her kin. The \ncastle itself looms over the city of Elysium, as per the request of \nit's original owner for some long forgotten reason. The sewers far \nbelow are quite the twisting maze of tunnels, supposedly reaching \nas far as the Desolate Zone and are inhabited by ratfolk and \ngator alike.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Hilltop Castle',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Barricade Turf" => {
                                  :switch_id => 1409,
                                  :category => :places,
                                  :info => "On the western edge of the city that makes up the Desolate Zone, \nlies a town created around the St.Robin's Memorial Hospital. Here, \nthe inhabitants fight bravely to defend their new home and their \nfriends. Zombies swarm outside the hastily built walls and armed \nguards fight on, desperate for the hordes to stop. The only saving \ngrace being that other monsters seem to fear the zombies as much \nas humans and haven't shown themselves since the horde arrived.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Barricade Turf',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Mansion Approach" => {
                                  :switch_id => 1410,
                                  :category => :places,
                                  :info => "East of the river that divides the zone, a mall holds this area's \nsuriving humans, whether they be players or NPCs. The outside \nstreets from the mall's exterior to the outskirts of the city park \nare swarming with zombies, wandering like lost children. And at the \nedge of the long road sits a old fashioned mansion, out of place \namong the city sights. A place known as one where many \nadventurers enter, looking for loot and rewards, but none ever leave.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Mansion Approach',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Northern Streets" => {
                                  :switch_id => 1411,
                                  :category => :places,
                                  :info => "Sitting in the shadow of the looming mountains, the northern roads \nof the city are long and fraught with danger. With the zombies \nfinally expelled the true owners of the city have returned, monsters \nof all kind have flocked to the area in hopes of catching some lone \nhuman as prey. On the eastern side of the river lies a safe place, \noriginally a part of Barricade Town, but now cut off from it's sister \ntown. The town still goes unnamed however, as its people have more \nimportant things to worry about.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Northern Streets',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Western Dunes" => {
                                  :switch_id => 1412,
                                  :category => :places,
                                  :info => "Atop a dusty hill lies a small camp, safe from the sandwurms that \nroam the sands. The nearby river provides fresh water from the \nmountains and keeps the shores green and bountiful. Even so, not all \nis safe here. An evil lurks just beneath the surface, festering and \ngrowing stronger as it waits to emerge. Ruins and lonely pillars \ndot the dunes, memories of days long past, or perhaps a prophecy \nfor the future.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Western Dunes',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Eastern Dunes" => {
                                  :switch_id => 1413,
                                  :category => :places,
                                  :info => "A dried up dead riverbed, a dusty mirror of the western desert. \nOverlooking it lies the town of Djeso, protected from the harsh \nsandstorms and wurms by it's high walls. The citizens, clustered \naround their little oasis, can still see the volcano over the walls, \nor at least its plume of black smoke. Few dare to venture close, \nfor fear of the lava, and the volcano's fiesty, scaled inhabitants. \nIt said Djeso was originally built by miners from a place beyond the \nmountains that enshroud the desert.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Eastern Dunes',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Mirane Captial" => {
                                  :switch_id => 1414,
                                  :category => :places,
                                  :info => "The captial city of the Kingdom of Mirane, a walled bastion against \nthe monsters and inhumans of the woods. Densely packed together \nhouses and shops make up the poorer parts of downtown. \nComfy homes, opens markets and fancy shops decorate the midtown. \nNo matter where you are however, you're always in the shadow \nof the castle.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Mirane',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "Mystic Woods" => {
                                  :switch_id => 1415,
                                  :category => :places,
                                  :info => "Thick and misty, it's not hard to lose ones way within the trees \nof the Mystic Woods. Entry is barred to most due to the danger \nwithin and those that do enter often find themselves with the \nfeeling of being watched. A few brave or perhaps foolish \nsouls make their home within, most notably the shrine maidens, \nwho have carved out a place of safety and sanctuary not just \nfrom the woods inhabitants.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Mystic Woods',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                "The Gleaming" => {
                                  :switch_id => 1416,
                                  :category => :places,
                                  :info => "An shadow of reality where the fae make their home. Ordered and \nchaotic at the same time, The Gleaming is a place not suited to \nhumans or the inhabitants of 'Humdrum' as the fae call them. \nThose living here have seperated themselves into three courts, \nruled by the most powerful fae around, who hoard their stolen \nriches of memories and lives. Even the fae fear what lies \nabove however, the home of their true ruler. The Emerald \nShadow is home to 'Queen Titania', supposedly a fae so powerful \nand unsettling that even the court leaders fear her.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Places/',
                                  :image_name => 'Gleaming',
                                  :icon? => true,
                                  :icon_index => 8866,
                },
                #---------------------------------------------------------------
                #    People
                #---------------------------------------------------------------
                "PXE" => {
                                  :switch_id => 211,
                                  :category => :people,
                                  :info => "This adorable little fairy is your 'Personal Xanadu Expert' an \nincredibly helpful little AI. While all players of Monline start \nwith their own PXE most disable theirs quickly. Supposedly some \nplayers find the PXE's 'annoying'.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'PXE',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "PXE" => { #Part 2 (Glitching)
                                  :switch_id => 212,
                                  :category => :people,
                                  :info => "Your 'Personal Xanadu Expert', after an encounter with Robin she was \n'reset' in an attempt to quell her fury towards the game's \ncreator. Now she is in a constant state of glitching.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'PXE 2',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "PXE" => { #Part 3 (Fixed)
                                  :switch_id => 213,
                                  :category => :people,
                                  :info => "Fixed of her glitches, and her memory restorted, PXE is working at \nfull functionality. After the events at the Emerald Shadow PXE \nProcessing Facility left her the sole survivor of her 'species', \nshe has vowed to help humanity fight back against Robin.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'PXE 3',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Robin" => {
                                  :switch_id => 201,
                                  :category => :people,
                                  :info => "The ruler of the world of Monline and the one who trapped everyone \nhere. Supposedly the sole designer of Monline, although you never \ntook much notice of the developer's names during the game's \nproduction. Robin appears to have a love of transformation and \nhas roped the entire playerbase into being the victims of their \ntwisted game.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Robin',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Mark" => {
                                  :switch_id => 202,
                                  :category => :people,
                                  :info => "Just another player who started out in the Forest Zone like you. \nSo far you've both saved each other from near certain doom.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Mark',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Mark " => { #Mark Part 2 (Post Sea Bishop)
                                  :switch_id => 209,
                                  :category => :people,
                                  :info => "Just another player who started out in the Forest Zone like you. \nSo far you've both saved each other from near certain doom. \nAfter defeating the Sea Bishop and obtaining the first Orb, the \ntwo of you decided to part ways in search of the others. Him heading \nwest, you heading east. Hopefully it won't take long for you \nboth to reunite.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Mark',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Percy" => {
                                  :switch_id => 1401,
                                  :category => :people,
                                  :info => "Despite the strange goings on around him this one seems to care \nvery little for his own safety and instead spends his time \ndocumenting each of the monsters he encounters.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Percy',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Aralu" => {
                                  :switch_id => 203,
                                  :category => :people,
                                  :info => "Aralu is a rather strange woman obsessed with doling out justice \nto the monsters that roam the island.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Aralu',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Aralu " => { #Aralu Part 2 (Post Draculara)
                                  :switch_id => 208,
                                  :category => :people,
                                  :info => "Child of the Vampire Queen Draculara, Aralu is a Dhampir, a \nhalf-vampire half-human hybrid. Fearful of becoming like her mother \nshe ran away and began enacting justice on those who couldn't \ncontrol their inhuman impulses, the monsters of Xanadu. With your \nhelp she defeated her sister, the High Succubus Amarya, and slayed \nher mother. Now she resides in the castle above Elysium City, \nteaching her younger siblings in hopes they may turn out like her.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Aralu',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Kim" => {
                                  :switch_id => 204,
                                  :category => :people,
                                  :info => "After meeting Kim at the edge of the Desolate Zone she's joined up \nwith you as an attempt to find the source of the zombie outbreak \nand avenge her friend.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Kim',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Kim" => { #Kim Part 2 (Post Lich)
                                  :switch_id => 210,
                                  :category => :people,
                                  :info => "After meeting Kim at the edge of the Desolate Zone she joined up \nwith you as an attempt to find the source of the zombie outbreak \nand avenge her friend. With the mad scientist Mara defeated, the \ntwo of you continued on together, determined to defeat Robin and \nsave the people trapped in this world. She's kind-hearted and \nintelligent, though she has a fierce temper and is just a slight \nbit too naive at times.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Kim',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Lina" => {
                                  :switch_id => 204,
                                  :category => :people,
                                  :info => "A vile woman who relishes the power the world of Monline has given her \nover others. Formerly working under the scientist Mara, \nshe fled when the woman turned lich was defeated and her \nwhereabouts are now unknown.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Lina',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Lina" => { #Lina Part 2 (Post Bastet)
                                  :switch_id => 216,
                                  :category => :people,
                                  :info => "Her evil actions have finally caught up with her, having fallen prey \nto a reflected shot from her own Bimboizing Ray Gun \nthis happy-go-lucky biker remembers nothing of her former self. \nIt's probably better that way for everyone.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Lina 2',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Morgan" => {
                                  :switch_id => 204,
                                  :category => :people,
                                  :info => "Having lost his own party and friends early on during his adventure, \nthis man has turned to any means necessary to survive, \neven allying with the scientist Mara and her immoral experiments.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Morgan',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Morgan" => { #Morgan Part 2 (Post Pyramid)
                                  :switch_id => 218,
                                  :category => :people,
                                  :info => "Having lost his own party and friends early on during his adventure, \nthis man has turned to any means necessary to survive. \nDuring your time in the Pyramid he willingly worked with the Pharaoh \nFarinet so as not to suffer the fate of her 'subjects'.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Morgan',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Dominic" => {
                                  :switch_id => 205,
                                  :category => :people,
                                  :info => "In the real world he was a popular streamer called 'DMO', and was \nknown for his actions in many other games. In Monline he is just as \npopular with his fans and is using them to hunt down the Desert \nZone's treasure. \nHe seems to be friends with the wildwoman Fera.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Dominic',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Dominic" => { #Dom Part 2 (Post Pyramid)
                                  :switch_id => 214,
                                  :category => :people,
                                  :info => "After a not so impressive introduction where he fought against you \nat Morgan's side and was possessed by a Pharaoh, Dominic joined \nyour team to make amends for his failure, at the request of his \nfriend Fera. More than a little vain and popularity obsessed, \nDominic also goes by the online handle 'DMO' to his streams viewers.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Dominic',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Fera" => {
                                  :switch_id => 206,
                                  :category => :people,
                                  :info => "A rather strange woman, Fera is mostly quiet and prefers to talk \nin short stilted sentences or animal like growls. She allied \nherself with the group in order to stop her friend Dominic from \nmaking a foolish mistake. Despite her somewhat standoffish \npersonality she has an odd sense of humour that she is not afraid to \nshow off.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Fera',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Fera" => { #Fera Part 2 (Post Shrine)
                                  :switch_id => 220,
                                  :category => :people,
                                  :info => "Claiming herself to be an 'actor' of sorts, this roleplayer has \ngracefully accepted her new role as shrine maiden and host to \nthe Kitsune spirit. Kitsune worked to protect those from Robin's \ncorruption and all was going well until you stumbled in and \nruined everything. Despite everything her personality hasn't changed and \nshe still seems to enjoy teasing others, especially with a prankster \nspirit within her.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Fera 2',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Delta" => {
                                  :switch_id => 219,
                                  :category => :people,
                                  :info => "A self proclaimed genius hacker who worked with Lina to design \nmind controlling collars for her. He used the collars to create \nhis own harem of slaves before being stopped by you and Kim. \nAfter running back to Lina with his tail between his legs she \nbetrayed and collared him turning him into the loyal dog-like gremlin \nshe is now. After Lina was defeated Delta fled and her whereabouts \nare now unknown.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Delta',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                "Princess Rien" => {
                                  :switch_id => 207,
                                  :category => :people,
                                  :info => "Heir to the throne of Mirane, she was formerly missing after \nrunning away to hunt down her friend's kidnapper and getting herself \npetrified. During the hunt for her your ran into a magical trap she \nset and ended up as her 'replacement'. \nShe is prim and proper but with a fiesty personality, and \nthe magical prowess to back that up.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/People/',
                                  :image_name => 'Rien',
                                  :icon? => true,
                                  :icon_index => 8865,
                },
                #---------------------------------------------------------------
                #    States
                #---------------------------------------------------------------
                "Death" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted won't be able to fight, use items or guard! \nThis state is automatically applied when you run out of HP.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 224,
                },
                "Poison" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "At the end of the turn the affected person will take damage based \non their MAT stat, this effect cannot cause death. \nLasts 1-5 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 225,
                },
                "Blind" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "Lowers the afflicted's chance to hit by 40%. \nLasts 1 turn.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 226,
                },
                "Sealed" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted cannot use any Abilities while Sealed! \nLasts 2-3 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 227,
                },
                "Enraged" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted attacks at random and can even hit their allies! \nLasts 2-4 turns. 50% chance to be removed when taking damage.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 9058,
                },
                "Sleep" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted cannot act or evade attacks. \nLasts 2-3 turns. Removed when taking damage.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 229,
                },
                "Paralysis" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted cannot evade attacks. \nLasts 1-3 turns. 50% chance to be removed when taking damage.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 230,
                },
                "Stun" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted cannot act or evade attacks. \nLasts 1 turn. 50% chance to be removed when taking damage.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 231,
                },
                "Provoke" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted is far more likely to be targeted. \nLasts 3 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 362,
                },
                "HP Regen" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "Increases the afflicted's HP Regeneration Rate by 6%. \nLasts 4 turns. 40% chance to be removed when taking damage.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 356,
                },
                "MP Regen" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "Increases the afflicted's MP Regeneration Rate by 6%. \nLasts 4 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 375,
                },
                "AD Regen" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "Increases the afflicted's AD Regeneration Rate by 8%. \nLasts 4 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 354,
                },
                "Ironbody" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted takes 30% less damage from Physical Attacks. \nLasts 3 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 352,
                },
                "Frisky" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted takes double damage from Lust based attacks and is \n25% more likely to become Charmed. The afflicted gains AD as 125% \nthe normal rate and their weapon attacks do Lust damage. \nLasts 2-3 turns. 20% chance to be removed when taking damage.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 12013,
                },
                "Calm" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted gains 3% HP and MP Regeneration, takes 10% less \ndamage and has a 25% chance to be able to act twice. The afflicted \nalso cannot be inflicted with Frisky or Enraged. \nLasts 4 turns. 20% chance to be removed when taking damage. \nIf the state is removed due to lasting the full 4 turns, the \nafflicted becomes Exhausted.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 9056,
                },
                "Risen" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted's ATK and MAT stats are increased by 25%. \nTypically applied after being revived. \nLasts 2 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 373,
                },
                "Flurry" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted gains an extra action each turn, and a 50% chance to \ngain an additional extra action each turn. \nLasts 2 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 398,
                },
                "Burned" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted's healing rate from abilties and items is reduced \nby 25%. At the end of the turn the affected person will take damage \nbased on their ATK stat, this effect cannot cause death.  \nLasts 3-4 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 9057,
                },
                "Chilled" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted's attack speed is reduced by 10 stages. \nTheir Evasion rate is also reduced by 50%. \nLasts 3-4 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 353,
                },
                "Stinky" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted's healing rate from abilities and items is reduced by 50%. \nLasts 3-5 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 382,
                },
                "Dizzy" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted's Evasion and Hit rates are reduce \nby 50%. Every time they attack they'll take damage \nbased on their ATK or MAT stat. Lasts 1-3 turns. \n50% chance to be removed when taking damage.",                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 228,
                },
                "Exhaustion" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted can't move and takes double damage. \nLasts 2 turns.",
                                  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 383,
                },
                "Anchored" => {
                                  :switch_id => 0,
                                  :category => :states,
                                  :info => "The afflicted is immune to Stun, Dizzy, Paralysis and Sleep. \nLasts 3 turns.",                                  
								  :image? => false,
                                  :folder => 'Graphics/Encyclopedia/Topics/',
                                  :image_name => 'Extra',
                                  :icon? => true,
                                  :icon_index => 9060,
                },
                #---------------------------------------------------------------
                #    Tips
                #---------------------------------------------------------------
                "Basic Controls" => {
                                  :switch_id => 0,
                                  :category => :tips,
                                  :info => "Arrow Keys: Move on the map, move the menu cursor. \nZ: Interact, Select Menu Option. \nX: Cancel. \nA: Hides the Text Box. \nShift: Toggles Sprint on the map. \nCtrl: Speeds up text. \nF6: Change Screen Size. \nF12: Return to the Title Screen (Unstable!)",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Other/',
                                  :image_name => 'BasicControls',
                                  :icon? => true,
                                  :icon_index => 8869,
                },
                "QTE Controls" => {
                                  :switch_id => 0,
                                  :category => :tips,
                                  :info => "At times, while exploring the world you maybe be \nrequired to act quickly and input a series of specific \nkey presses to proceed. If you fail to press the \ncorrect keys in order before time runs out there may \nbe dire consequences. The keys you may be asked to \npress are: Z, X, Q, W, A, S, D, Shift and the Arrow Keys.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Other/',
                                  :image_name => 'QTEControls',
                                  :icon? => true,
                                  :icon_index => 8869,
                },
                "Combat Controls" => {
                                  :switch_id => 0,
                                  :category => :tips,
                                  :info => "Arrow Keys: Move the menu cursor. \nZ: Select a character's action. \nX Move to the combat overview menu. \nShift: Examine the highlighted target. \nQ & W: Switch info screens for the examined target.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Other/',
                                  :image_name => 'CombatControls',
                                  :icon? => true,
                                  :icon_index => 8869,
                },
                "Main Stats" => {
                                  :switch_id => 0,
                                  :category => :tips,
                                  :info => "The gear you equip and the abilities you take will factor \nheavily into your character's stats. \nSpecifically, the six Main Stats: \nAttack: Damage you deal with physical attacks.\nDefense: Damage you take from physical attacks.\nMagic Attack: Damage you deal with magical attacks.\nMagic Defense: Damage you take from magical attacks.\nAgility: Order characters will act in battle.\nLuck: Chance you will evade attacks, and to critically hit.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Other/',
                                  :image_name => 'MainStats',
                                  :icon? => true,
                                  :icon_index => 8869,
                },
                "Extra Stats" => {
                                  :switch_id => 0,
                                  :category => :tips,
                                  :info => "There are variety of secondary stats the can also have an \nimportant effect in battle. \nSome are calculated using other stats. \nHit Rate: Calculated from your ATK and AGI. \nEvasion Rate: Calculated from your AGI and LUK. \nCritical Rate: Calculated from your LUK. \nGuard Rate: Calculated from your DEF and MDF.",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Other/',
                                  :image_name => 'ExtraStats',
                                  :icon? => true,
                                  :icon_index => 8869,
                },
                "Cheat Codes" => {
                                  :switch_id => 0,
                                  :category => :tips,
                                  :info => "Using the 'Cheats' option on the main menu, you can \naccess the cheat code input screen. Here you'll be able to \ninput codes with a wide variety of effects, from unique \nstarting equipment to skipping entire parts of the game.\nExample Codes:\nSKIP1 : Skip the intro, starting in Caste City \nSKIP3 : Skip to the end of the Coastal Zone \nRosebud : Add 1000G to the next loaded save file \nAnd many more!",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Other/',
                                  :image_name => 'CheatCodes',
                                  :icon? => true,
                                  :icon_index => 8869,
                },
                "Fate Locked" => {
                                  :switch_id => 0,
                                  :category => :tips,
                                  :info => "During gameplay there may be times when you have \nwandered into an inescapeable situation. \nWhen these situations occur, your fate will be 'locked' and \nan overlay will appear around the edges of the screen. \nThis is a warning to be careful about saving the game, even \nthough you can, doesn't mean you should. Unless you really \nwant to come back to that helpless state. Definitely not. \nNote: Not all inescapable situations have been updated to \nshow the overlay. You have a lot of save slots, use them!",
                                  :image? => true,
                                  :folder => 'Graphics/Encyclopedia/Topics/Other/',
                                  :image_name => 'FateLock',
                                  :icon? => true,
                                  :icon_index => 8869,
                },
    } # <= Não deletar.
    
  end # Encyclopedia
end # Nova
#==============================================================================
# ▼ - Fim das Configurações -
# Alterar algo após aqui pode causar falhas no funcionamento do sistema.
#==============================================================================

#═══════════════════════════════════════════════════════════════════════════════
# ■ Encyclopedia
#═══════════════════════════════════════════════════════════════════════════════
class Encyclopedia < Scene_Base
  include Nova::Encyclopedia
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Start
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def start
    super
    exec_instance_variables
    exec_background
    exec_particles
    exec_all_windows
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec Instance Variables
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_instance_variables
    @particles = []
    @global_mode = nil
    @category = nil
    @category_bitmap = nil
    @topics_bitmap = nil
    @text_index = nil
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec All Windows
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_all_windows
    
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    # ● Help Window
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    hw = Graphics.width;    hh = 48
    hx = 0;                 hy = Graphics.height - hh
    @pedia_help = Pedia_Help.new(hx, hy, hw, hh)
    @pedia_help.category_text; @pedia_help.help_bar
    
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    # ● Category Window
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    cx = 0;                     cy = 0
    cw = Graphics.width * 0.4;  ch = Graphics.height - @pedia_help.height
    @pedia_category = Pedia_Category.new(cx, cy, cw, ch)
    exec_category_sprites; @pedia_category.back_sprite
    
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    # ● Topics Window
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    tx = 0;                     ty = 0
    tw = Graphics.width * 0.4;  th = Graphics.height - @pedia_help.height
    @pedia_topics = Pedia_Topics.new(tx, ty, tw, th)
    exec_topics_sprites; @pedia_topics.back_sprite
    if Topics_Main[:image?]
      @pedia_topics.back_box.visible = false
    end
    
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    # ● Info Window
    #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    px = 180;   py = Graphics.height * 0.3
    pw = Graphics.width - px;   ph = (Graphics.height - py) - @pedia_help.height
    @pedia_info = Pedia_Information.new(px, py, pw, ph)
    @pedia_info.visible = false; @pedia_info.back_sprite
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec Background
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_background
    @background = Sprite.new
    if Background[:enable?]
      @background.bitmap = Bitmap.new(Background[:folder] + Background[:name])
      if Background[:scale_to_fit?]
        @background.zoom_x = Graphics.width.to_f / @background.bitmap.width
        @background.zoom_y = Graphics.height.to_f / @background.bitmap.height
      end
    else
      @background.bitmap = SceneManager.background_bitmap
      @background.color.set(16, 16, 16, 128)
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec Particles
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_particles
    if Particles[:enable?]
      for num in 0..Particles[:amount]
        @particles.push(Pedia_Particles.new)
      end
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec Category Sprites
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_category_sprites
    @category_sprite = Sprite.new
    @category_sprite.z = 100
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec Topics Sprites
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_topics_sprites
    @topics_sprite = Sprite.new
    @topics_sprite.z = 100
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Update
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def update
    super
    method_return if Input.trigger?(:B)
    flip_global_mode
    flip_mode
    method_particles
    method_category_sprites
    method_topics_sprites
    method_information
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Method Return
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def method_return
    return if @pedia_category.nil? || !@pedia_category.active
    if Input.trigger?(:B)
      Sound.play_cancel
      return_scene
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Flip Global Mode
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def flip_global_mode
    if @pedia_category.active
      @global_mode = :category
    else
      @global_mode = :topics
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Flip Mode
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def flip_mode
    if @global_mode == :category
      if Input.trigger?(:C)
        Sound.play_ok
        flip_topics
      end
    elsif @global_mode == :topics
      if Input.trigger?(:B)
        Sound.play_cancel
        method_topics_hide
      end
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Flip Topics
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def flip_topics
    data = @pedia_category.data[@pedia_category.index]
    @category = data[:symbol]
    method_category_hide
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Method Category Hide
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def method_category_hide
    @pedia_category.deactivate
    @pedia_category.visible = false
    if Category_Main[:image?]
      @pedia_category.back_box.visible = false
    end
    @category_sprite.visible = false
    @pedia_help.topic_text
    @pedia_topics.exec_commands(@category)
    @pedia_topics.visible = true
    if Topics_Main[:image?]
      @pedia_topics.back_box.visible = true
    end
    @pedia_info.visible = true
    if Info_Main[:image?]
      @pedia_info.back_box.visible = true
    end
    if @pedia_topics.data == []
      @topics_sprite.visible = false
    else
      @topics_sprite.visible = true
    end
    @pedia_topics.activate
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Method Topics Hide
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def method_topics_hide
    @pedia_topics.deactivate
    @pedia_topics.visible = false
    if Topics_Main[:image?]
      @pedia_topics.back_box.visible = false
    end
    @pedia_info.visible = false
    if Info_Main[:image?]
      @pedia_info.back_box.visible = false
    end
    @topics_sprite.visible = false
    @pedia_help.category_text
    @pedia_category.visible = true
    if Category_Main[:image?]
      @pedia_category.back_box.visible = true
    end
    @category_sprite.visible = true
    @pedia_category.activate
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Method Information
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def method_information
    data = @pedia_topics.data[@pedia_topics.index]
    return if data.nil?
    text = data[:info]
    if @text_index != text
      @text_index = text
      @pedia_info.display_info(text)
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Method Particles
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def method_particles
    if Particles[:enable?]
      @particles.each do |particle|
        particle.animate
      end
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Method Category Sprites
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def method_category_sprites
    data = @pedia_category.data[@pedia_category.index]
    path = data[:folder]
    name = data[:image_name]
    if @category_bitmap != path + name
      @category_bitmap = path + name
      if data[:image?]
        @category_sprite.bitmap = Bitmap.new(path + name)
      else
        @category_sprite.bitmap = Bitmap.new(1, 1)
      end
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Method Topics Sprites
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def method_topics_sprites
    data = @pedia_topics.data[@pedia_topics.index]
    return if data.nil?
    path = data[:folder]
    name = data[:image_name]
    
    if @topics_bitmap != path + name
      @topics_bitmap = path + name
      if data[:image?]
        @topics_sprite.bitmap = Bitmap.new(path + name)
      else
        @topics_sprite.bitmap = Bitmap.new(1, 1)
      end
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Terminate
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def terminate
    super
    @particles.each do |particle|
      particle.bitmap.dispose
      particle.dispose
    end
    instance_variables.each do |iv|
      ig = instance_variable_get(iv)
      ig.bitmap.dispose if ig.is_a?(Sprite) && !ig.bitmap.nil?
      ig.dispose if ig.is_a?(Sprite)
    end
  end
  
end # Encyclopedia

#═══════════════════════════════════════════════════════════════════════════════
# ■ Pedia_Particles
#═══════════════════════════════════════════════════════════════════════════════
class Pedia_Particles < Sprite
  include Nova::Encyclopedia
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Initialize
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def initialize(viewport = nil)
    super
    setup
    @anim_type = nil
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Setup
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def setup
    @speed = Particles[:animation][:speed1_min] + rand(Particles[:animation][:speed1_max] - 1)
    @speed2 = Particles[:animation][:speed2_min] + rand(Particles[:animation][:speed2_max] - 1)
    @angletype = rand(2)
    ind = rand(Particles[:name].size)
    self.bitmap = Bitmap.new(Particles[:folder] + Particles[:name][ind])
    self.blend_type = rand(2)
    self.x = rand(Graphics.width)
    self.y = rand(Graphics.height) if !anim_up && !anim_down
    self.y = Graphics.height + rand(Graphics.height) if anim_up
    self.y = -rand(Graphics.height) if anim_down
    self.ox = self.bitmap.width / 2
    self.oy = self.bitmap.height / 2
    self.zoom_x = rand(2)
    self.zoom_y = self.zoom_x
    self.opacity = 0
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Animate
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def animate
    if anim_up && !anim_down
      setup if self.y <= -50
      self.y -= @speed
    end
    if anim_down && !anim_up
      setup if self.y >= Graphics.height + 50
      self.y += @speed
    end
    if anim_right && !anim_left
      setup if self.x >= Graphics.width + 50
      self.x += @speed2
    end
    if anim_left && !anim_right
      setup if self.x <= -50
      self.x -= @speed2
    end
    if @angletype == 1
      self.angle += rand(4)
    else
      self.angle -= rand(4)
    end
    self.opacity += 2 unless self.opacity >= 255
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Directions
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def anim_up;      return Particles[:animation][:up];    end
  def anim_down;    return Particles[:animation][:down];  end
  def anim_right;   return Particles[:animation][:right]; end
  def anim_left;    return Particles[:animation][:left];  end
  
end # Pedia_Particles

#═══════════════════════════════════════════════════════════════════════════════
# ■ Pedia_Category
#═══════════════════════════════════════════════════════════════════════════════
class Pedia_Category < Window_Selectable
  include Nova::Encyclopedia
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Public Variables
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  attr_reader :data
  attr_accessor :back_box
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Initialize
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def initialize(x, y, w, h)
    super
    self.windowskin = Cache.system(Category_Main[:windowskin])
    select(0)
    activate
    @data = []
    @commands = []
    Categories.each_key do |category|
      switch_id = Categories[category][:switch_id]
      next unless $game_switches[switch_id] || switch_id == 0
      @data.push(Categories[category])
      @commands.push(category)
    end
    exec_commands
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec Commands
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_commands
    for c in 0..@commands.size - 1
      if @data[c][:icon?] == true
        draw_icon(@data[c][:icon_index], 4, line_height * c)
      end
      draw_command(@commands[c], c, @data[c][:icon?])
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Draw Command
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def draw_command(com, ind, icon)
    x = icon ? 32 : 4
    self.contents.draw_text(x, line_height * ind, self.width, line_height, com)
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Item Max
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def item_max
    @data.nil? ? 0 : @data.size
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Back Sprite
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def back_sprite
    if Category_Main[:image?]
      self.opacity = 0
      @back_box = Sprite.new
      @back_box.z = self.z - 1
      path = Category_Main[:folder]
      name = Category_Main[:name]
      @back_box.bitmap = Bitmap.new(path + name)
      @back_box.ox = Category_Main[:img_ox]
      @back_box.oy = Category_Main[:img_oy]
      @back_box.x = self.x
      @back_box.y = self.y
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Dispose
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
#  def dispose
#    super
#    @back_box.bitmap.dispose; @back_box.dispose
#  end
  
end # Pedia_Category

#═══════════════════════════════════════════════════════════════════════════════
# ■ Pedia_Help
#═══════════════════════════════════════════════════════════════════════════════
class Pedia_Help < Window_Base
  include Nova::Encyclopedia
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Initialize
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def initialize(x, y, w, h)
    super
    self.windowskin = Cache.system(Help[:windowskin])
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Category Text
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def category_text
    contents.clear
    draw_text_ex(0, 0, Help[:category_vocab])
  end
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Topic Text
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def topic_text
    contents.clear
    draw_text_ex(0, 0, Help[:topics_vocab])
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Help Bar
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def help_bar
    if Help[:image?]
      self.opacity = 0
      @help_bar = Sprite.new
      @help_bar.z = self.z - 1
      path = Help[:folder]
      name = Help[:name]
      @help_bar.bitmap = Bitmap.new(path + name)
      @help_bar.ox = Help[:img_ox]
      @help_bar.oy = Help[:img_oy]
      @help_bar.x = self.x
      @help_bar.y = self.y
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Dispose
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
#  def dispose
#    super
#    @help_bar.bitmap.dispose; @help_bar.dispose
#  end
  
end # Pedia_Help

#═══════════════════════════════════════════════════════════════════════════════
# ■ Pedia_Topics
#═══════════════════════════════════════════════════════════════════════════════
class Pedia_Topics < Window_Selectable
  include Nova::Encyclopedia
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Public Variables
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  attr_reader :data
  attr_accessor :back_box
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Initialize
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def initialize(x, y, w, h)
    super
    self.windowskin = Cache.system(Topics_Main[:windowskin])
    self.visible = false
    select(0)
    @data = []
    @commands = []
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Exec Commands
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def exec_commands(cat)
    @data.clear
    @commands.clear
    self.contents.clear
    Topics.each_key do |category|
      switch_id = Topics[category][:switch_id]
      next unless $game_switches[switch_id] || switch_id == 0
      next if Topics[category][:category] != cat
      @data.push(Topics[category])
      @commands.push(category)
    end
    refresh    
    for c in 0..@commands.size - 1
      if @data[c][:icon?] == true
        draw_icon(@data[c][:icon_index], 4, line_height * c)
      end
      draw_command(@commands[c], c, @data[c][:icon?])
    end
    while index >= @data.size
      unselect
    end
    if index < 0
      select(0)
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Refresh
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def refresh
    create_contents
    super
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Draw Command
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def draw_command(com, ind, icon)
    x = icon ? 32 : 4
    self.contents.draw_text(x, line_height * ind, self.width, line_height, com)
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Item Max
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def item_max
    @data.nil? ? 0 : @data.size
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Back Sprite
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def back_sprite
    if Topics_Main[:image?]
      self.opacity = 0
      @back_box = Sprite.new
      @back_box.z = self.z - 1
      path = Topics_Main[:folder]
      name = Topics_Main[:name]
      @back_box.bitmap = Bitmap.new(path + name)
      @back_box.ox = Topics_Main[:img_ox]
      @back_box.oy = Topics_Main[:img_oy]
      @back_box.x = self.x
      @back_box.y = self.y
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Dispose
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
#  def dispose
#    super
#    @back_box.bitmap.dispose; @back_box.dispose
#  end
  
end # Pedia_Topics

#═══════════════════════════════════════════════════════════════════════════════
# ■ Pedia_Information
#═══════════════════════════════════════════════════════════════════════════════
class Pedia_Information < Window_Base
  include Nova::Encyclopedia
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Public Variables
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  attr_accessor :back_box
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Initialize
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def initialize(x, y, w, h)
    super
    self.contents.font.name = Info_Main[:font_name]
    self.contents.font.size = Info_Main[:font_size]
    self.contents.font.color = Info_Main[:font_color]
    self.contents.font.outline = Info_Main[:font_outline]
    self.windowskin = Cache.system(Info_Main[:windowskin])
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Display Info
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def display_info(text)
    self.contents.clear
    draw_text_ex(0, -5, text)
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Reset Font Settings
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def reset_font_settings; end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Back Sprite
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def back_sprite
    if Info_Main[:image?]
      self.opacity = 0
      @back_box = Sprite.new
      @back_box.visible = false
      @back_box.z = self.z - 1
      path = Info_Main[:folder]
      name = Info_Main[:name]
      @back_box.bitmap = Bitmap.new(path + name)
      @back_box.ox = Info_Main[:img_ox]
      @back_box.oy = Info_Main[:img_oy]
      @back_box.x = self.x
      @back_box.y = self.y
    end
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Dispose
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
#  def dispose
#    super
#    @back_box.bitmap.dispose;   @back_box.dispose
#  end
  
end # Pedia_Information

#═══════════════════════════════════════════════════════════════════════════════
# ■ Window_MenuCommand
#═══════════════════════════════════════════════════════════════════════════════
class Window_MenuCommand < Window_Command
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Add Save Command
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  alias :nv_e_asc add_save_command
  def add_save_command
    pedia = Nova::Encyclopedia::Command_in_Menu
    flag = pedia[:switch]
    on = flag == 0 ? true : $game_switches[pedia[:switch]]
    if pedia[:enable?]
      add_command(pedia[:name], :pedia, on)
    end
    nv_e_asc
  end
  
end # Window_MenuCommand

#═══════════════════════════════════════════════════════════════════════════════
# ■ Scene_Menu
#═══════════════════════════════════════════════════════════════════════════════
class Scene_Menu < Scene_MenuBase
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Create Command Window
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  alias :nv_pedia_ccw create_command_window
  def create_command_window
    nv_pedia_ccw
    @command_window.set_handler(:pedia, method(:nova_pedia))
  end
  
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 # ● Nova Pedia
 #▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  def nova_pedia
    SceneManager.call(Encyclopedia)
  end
  
end # Scene_Menu