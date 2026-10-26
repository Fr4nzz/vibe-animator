# Reference-art library: sources and licences

Every file here is a real illustration, flattened from SVG to JSON by `engine/tools/svgflat.py` (vectors) or kept as a
raster (PNG/JPG), and restyled at runtime as engraved line art by `app/src/scenes/_refart.ts` (`loadRef('<name>')`,
without `.json`). The geometry is the original's own.

**Attribution is required for every CC BY item you show on screen.** Put a credit line in the video description, e.g.:
*Anatomical illustrations adapted from Servier Medical Art (https://smart.servier.com), CC BY 3.0 / CC BY 4.0 as listed;
DBCLS drawings CC BY 4.0; Bioicons (https://bioicons.com) CC0 items by their named authors; Gray's Anatomy (1918) plates,
public domain.* "Adapted" is accurate: the engraving restyles the drawing.

When you add a file: log it here (subject, author, licence, source URL) in the same commit. Do not add share-alike
(CC BY-SA), non-commercial or unknown-licence art. Copyrighted paper pages never go in this folder (see
`docs/WORKFLOW.md`, "Real paper pages").

| File | Subject | Author | Licence | Source |
|---|---|---|---|---|
| `body.json` | Human body, frontal, venous system, heart, liver, kidneys; head in profile | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Human_physiology/Servier/venous-circulation-body.svg |
| `brain.json` | Brain, lateral view | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Human_physiology/Servier/brain-2.svg |
| `mito.json` | Mitochondrion (outer/inner membrane, cristae) | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Intracellular_components/Servier/mitochondrium-1.svg |
| `mito2.json` | Mitochondrion, variant | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Intracellular_components/Servier/mitochondrium-2.svg |
| `neuron.json` | Cortical pyramidal neuron | Fabian Mikulasch (via Bioicons) | CC0 1.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-0/Human_physiology/Fabian-Mikulasch/Pyramidal_Neuron.svg |
| `kidney.json` | Kidney, external view with ureter | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Human_physiology/Servier/kidney-1.svg |
| `nephron.json` | Nephron, line drawing | Emily A. Daniel (via Bioicons) | CC0 1.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-0/Tissues/EmilyADaniel/nephron_2d.svg |
| `macrophage.json` | Macrophage | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Blood_Immunology/Servier/macrophage.svg |
| `neutrophil.json` | Neutrophil | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Blood_Immunology/Servier/neutrophil-granulocyte.svg |
| `rbc.json` | Red blood cell | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Blood_Immunology/Servier/erythrocyte-1.svg |
| `foot_bones.json` | Foot bones, dorsal view | DBCLS (via Bioicons) | CC BY 4.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-4.0/Human_physiology/DBCLS/Dorsal_view_of_bones_of_right_foot.svg |
| `hip_femur.json` | Proximal femur and hip joint, frontal section | DBCLS (via Bioicons) | CC BY 4.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-4.0/Human_physiology/DBCLS/frontal_section_through_hip_joint.svg |
| `muscle_fiber.json` | Skeletal muscle fascicle with myofibrils | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Human_physiology/Servier/muscle-fiber.svg |
| `mouse.json` | Laboratory mouse | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Animals/Servier/mouse-gray.svg |
| `fish.json` | Fish | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Animals/Servier/fish-1.svg |
| `membrane.json` | Lipid bilayer | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Cell_membrane/Servier/membrane-2d-yellowblue.svg |
| `phospholipid.json` | Phospholipid | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Cell_membrane/Servier/lipid-blue.svg |
| `skeleton.json` | Human skeleton, frontal | Mikael Häggström (from LadyofHats' Human skeleton front.svg), Wikimedia Commons | Public domain | https://commons.wikimedia.org/wiki/File:Human_skeleton_front_-_no_labels.svg |
| `gray430_thigh.png` | Anterior thigh muscles (Gray fig. 430), raster | Henry Vandyke Carter, Gray's Anatomy (1918) | Public domain | https://commons.wikimedia.org/wiki/File:Gray430.png |
| `cell.json` | Cell, complete cross-section (text labels not drawn) | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Intracellular_components/Servier/cell-complete.svg |
| `heart.json` | Heart, front view | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Human_physiology/Servier/heart-front.svg |
| `zebra_finch.png` | Zebra finch, raster | DataBase Center for Life Science (DBCLS), Wikimedia Commons | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:201903_Zebra_finch.svg |
| `hematopoiesis.json` | Haematopoiesis tree | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Blood_Immunology/Servier/hematopoesis.svg |
| `stem_cell.json` | Haematopoietic stem cell | Servier Medical Art (via Bioicons) | CC BY 3.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-by-3.0/Blood_Immunology/Servier/hematopoetic-stem-cell.svg |
| `hopping_mouse.png` | Notomys hopping mouse, XDoG line trace of plate 29, Zoology of the Voyage of H.M.S. Erebus & Terror (1844-75) | J. E. Gray & J. Richardson (eds.) | Public domain | https://commons.wikimedia.org/wiki/File:Notomys_longicaudatus.jpg |
| `cell_culture.json` | Cultured cells in a dish, side view | Marcel Tisch (via Bioicons) | CC0 1.0 | https://github.com/duerrsimon/bioicons/blob/main/static/icons/cc-0/Cell_culture/Marcel_Tisch/cells_side_view.svg |
| `c2_wash_student.png`, `c2_wash_master.png` | Two seated figures in conversation, watercolour wash (median/mode-filtered pools, paper keyed out except over the master's face and white beard, wet edges; `engine/work/c2_refs/wash.py`) of folio 86r, Maqamat al-Hariri (BnF Arabe 5847), Baghdad 1237 | Yahya ibn Mahmud al-Wasiti | Public domain | https://commons.wikimedia.org/wiki/File:Maqamat_al-Hariri,_folio_86r_(detail).jpg |
