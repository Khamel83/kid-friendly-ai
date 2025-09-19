import { Animal } from '../types/animalGame';

export class AnimalDatabase {
  private static instance: AnimalDatabase;
  private animals: Animal[] = [];

  private constructor() {
    this.initializeAnimals();
  }

  public static getInstance(): AnimalDatabase {
    if (!AnimalDatabase.instance) {
      AnimalDatabase.instance = new AnimalDatabase();
    }
    return AnimalDatabase.instance;
  }

  private initializeAnimals() {
    this.animals = [
      {
        id: 'lion',
        name: 'Lion',
        species: 'Panthera leo',
        habitat: 'African savanna, grasslands',
        diet: 'carnivore',
        size: 'large',
        lifespan: 15,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Lions are the only cats that live in groups called prides',
          'A lion\'s roar can be heard from 5 miles away',
          'Female lions do most of the hunting for the pride'
        ],
        sounds: ['roar', 'growl', 'purr'],
        behaviors: ['hunting', 'social bonding', 'territorial marking'],
        adaptations: ['sharp claws', 'powerful jaws', 'night vision', 'camouflage fur']
      },
      {
        id: 'elephant',
        name: 'African Elephant',
        species: 'Loxodonta africana',
        habitat: 'African forests, savannas, and deserts',
        diet: 'herbivore',
        size: 'giant',
        lifespan: 60,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Elephants have the longest pregnancy of any mammal - 22 months',
          'They can recognize themselves in mirrors',
          'Elephants use their trunks to smell, breathe, drink, and grab things'
        ],
        sounds: ['trumpet', 'rumble', 'roar'],
        behaviors: ['mud bathing', 'social grooming', 'migratory walking'],
        adaptations: ['trunk', 'tusks', 'large ears for cooling', 'thick skin']
      },
      {
        id: 'dolphin',
        name: 'Bottlenose Dolphin',
        species: 'Tursiops truncatus',
        habitat: 'Ocean waters worldwide',
        diet: 'carnivore',
        size: 'medium',
        lifespan: 45,
        conservationStatus: 'least concern',
        funFacts: [
          'Dolphins have names for each other - unique whistle signatures',
          'They sleep with one eye open',
          'Dolphins use echolocation to find food and navigate'
        ],
        sounds: ['click', 'whistle', 'burst-pulse'],
        behaviors: ['leaping', 'social play', 'hunting cooperatively'],
        adaptations: ['echolocation', 'streamlined body', 'blubber for insulation', 'dorsal fin']
      },
      {
        id: 'penguin',
        name: 'Emperor Penguin',
        species: 'Aptenodytes forsteri',
        habitat: 'Antarctic ice and waters',
        diet: 'carnivore',
        size: 'medium',
        lifespan: 20,
        conservationStatus: 'near threatened',
        funFacts: [
          'Male penguins incubate eggs on their feet for 64 days',
          'They can dive up to 500 meters deep',
          'Penguins huddle together for warmth in temperatures as low as -60°C'
        ],
        sounds: ['bray', 'trumpet', 'contact call'],
        behaviors: ['huddling', 'sliding', 'diving'],
        adaptations: ['dense feathers', 'blubber layer', 'counter-current heat exchange', 'streamlined body']
      },
      {
        id: 'giraffe',
        name: 'Giraffe',
        species: 'Giraffa camelopardalis',
        habitat: 'African savannas and open woodlands',
        diet: 'herbivore',
        size: 'giant',
        lifespan: 25,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Giraffes only need 5-30 minutes of sleep per day',
          'Their tongues are blue-black and up to 18 inches long',
          'A giraffe\'s heart weighs 25 pounds'
        ],
        sounds: ['bleat', 'snort', 'grunt'],
        behaviors: ['necking', 'browsing high branches', 'social licking'],
        adaptations: ['long neck', 'prehensile tongue', 'large heart', 'specialized valves in neck veins']
      },
      {
        id: 'panda',
        name: 'Giant Panda',
        species: 'Ailuropoda melanoleuca',
        habitat: 'Chinese mountain forests',
        diet: 'omnivore',
        size: 'large',
        lifespan: 20,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Pandas spend 10-16 hours per day eating bamboo',
          'They have an extra "thumb" to help grip bamboo',
          'Baby pandas are pink and hairless at birth'
        ],
        sounds: ['bleat', 'honk', 'growl'],
        behaviors: ['bamboo eating', 'tree climbing', 'somersaulting'],
        adaptations: ['false thumb', 'strong jaws', 'digestive system for bamboo', 'camouflage coloring']
      },
      {
        id: 'koala',
        name: 'Koala',
        species: 'Phascolarctos cinereus',
        habitat: 'Australian eucalyptus forests',
        diet: 'herbivore',
        size: 'small',
        lifespan: 15,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Koalas sleep 18-22 hours per day',
          'They have fingerprints similar to humans',
          'Baby koalas eat their mother\'s special droppings for digestion'
        ],
        sounds: ['grunt', 'scream', 'bellow'],
        behaviors: ['sleeping', 'eucalyptus eating', 'tree hugging'],
        adaptations: ['specialized digestive system', 'claws for climbing', 'thick fur', 'large nose']
      },
      {
        id: 'cheetah',
        name: 'Cheetah',
        species: 'Acinonyx jubatus',
        habitat: 'African grasslands and savannas',
        diet: 'carnivore',
        size: 'medium',
        lifespan: 12,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Cheetahs can go from 0 to 60 mph in 3 seconds',
          'They cannot roar - they purr like house cats',
          'Cheetahs use their tails as rudders when running'
        ],
        sounds: ['purr', 'chirp', 'bleat'],
        behaviors: ['sprinting', 'stalking prey', 'resting in trees'],
        adaptations: ['flexible spine', 'semi-retractable claws', 'tear marks', 'large lungs and heart']
      },
      {
        id: 'owl',
        name: 'Great Horned Owl',
        species: 'Bubo virginianus',
        habitat: 'Forests and deserts across Americas',
        diet: 'carnivore',
        size: 'medium',
        lifespan: 13,
        conservationStatus: 'least concern',
        funFacts: [
          'Owls can rotate their heads 270 degrees',
          'They have asymmetrical ear holes for better hearing',
          'Owls fly silently due to special feather structure'
        ],
        sounds: ['hoot', 'screech', 'hiss'],
        behaviors: ['nocturnal hunting', 'head turning', 'silent flight'],
        adaptations: ['night vision', 'silent flight feathers', 'sharp talons', 'rotatable head']
      },
      {
        id: 'turtle',
        name: 'Sea Turtle',
        species: 'Cheloniidae family',
        habitat: 'Ocean waters worldwide',
        diet: 'omnivore',
        size: 'large',
        lifespan: 50,
        conservationStatus: 'endangered',
        funFacts: [
          'Sea turtles return to the exact beach where they were born to nest',
          'They can hold their breath for several hours',
          'Temperature determines the sex of turtle eggs'
        ],
        sounds: ['hiss', 'grunt'],
        behaviors: ['long distance migration', 'nesting', 'basking'],
        adaptations: ['streamlined shell', 'salt glands', 'magnetic sense', 'flipper-like limbs']
      },
      {
        id: 'red-fox',
        name: 'Red Fox',
        species: 'Vulpes vulpes',
        habitat: 'Forests, grasslands, mountains, and deserts',
        diet: 'carnivore',
        size: 'medium',
        lifespan: 5,
        conservationStatus: 'least concern',
        funFacts: [
          'Red foxes have excellent hearing and can detect low-frequency sounds',
          'They can make over 40 different sounds',
          'Foxes use the Earth\'s magnetic field to hunt'
        ],
        sounds: ['bark', 'scream', 'howl'],
        behaviors: ['nocturnal hunting', 'burrowing', 'food caching'],
        adaptations: ['excellent night vision', 'sensitive whiskers', 'bushy tail for warmth', 'agile body']
      },
      {
        id: 'zebra',
        name: 'Zebra',
        species: 'Equus quagga',
        habitat: 'African grasslands and savannas',
        diet: 'herbivore',
        size: 'large',
        lifespan: 25,
        conservationStatus: 'near threatened',
        funFacts: [
          'No two zebras have the same stripe pattern',
          'Zebras can run up to 65 km/h (40 mph)',
          'Their stripes help confuse predators'
        ],
        sounds: ['neigh', 'bray', 'snort'],
        behaviors: ['herd living', 'migration', 'mutual grooming'],
        adaptations: ['unique stripes', 'strong teeth', 'excellent hearing', 'stamina for running']
      },
      {
        id: 'kangaroo',
        name: 'Red Kangaroo',
        species: 'Macropus rufus',
        habitat: 'Australian outback and grasslands',
        diet: 'herbivore',
        size: 'large',
        lifespan: 23,
        conservationStatus: 'least concern',
        funFacts: [
          'Kangaroos can hop up to 9 meters (30 feet) in a single bound',
          'They can swim long distances',
          'Female kangaroos can pause their pregnancy during droughts'
        ],
        sounds: ['grunt', 'cough', 'click'],
        behaviors: ['hopping', 'boxing', 'tail balancing'],
        adaptations: ['powerful hind legs', 'large feet', 'strong tail', 'pouch for young']
      },
      {
        id: 'raccoon',
        name: 'Raccoon',
        species: 'Procyon lotor',
        habitat: 'Forests and urban areas across North America',
        diet: 'omnivore',
        size: 'medium',
        lifespan: 3,
        conservationStatus: 'least concern',
        funFacts: [
          'Raccoons have extremely sensitive front paws',
          'They can remember solutions to tasks for up to 3 years',
          'Their black mask helps reduce glare'
        ],
        sounds: ['chitter', 'growl', 'purr'],
        behaviors: ['washing food', 'nocturnal foraging', 'den making'],
        adaptations: ['dexterous paws', 'excellent sense of touch', 'night vision', 'adaptive diet']
      },
      {
        id: 'eagle',
        name: 'Bald Eagle',
        species: 'Haliaeetus leucocephalus',
        habitat: 'Near large bodies of water across North America',
        diet: 'carnivore',
        size: 'large',
        lifespan: 25,
        conservationStatus: 'least concern',
        funFacts: [
          'Bald eagles can see fish from over a mile away',
          'They build the largest nests of any North American bird',
          'Eagles can fly up to 160 km/h (100 mph)'
        ],
        sounds: ['scream', 'chatter', 'piping'],
        behaviors: ['soaring', 'hunting', 'nest building'],
        adaptations: ['sharp talons', 'excellent vision', 'powerful beak', 'large wingspan']
      },
      {
        id: 'frog',
        name: 'Poison Dart Frog',
        species: 'Dendrobatidae family',
        habitat: 'Tropical rainforests of Central and South America',
        diet: 'carnivore',
        size: 'small',
        lifespan: 10,
        conservationStatus: 'varies by species',
        funFacts: [
          'Their bright colors warn predators of their toxicity',
          'Indigenous people used their poison for blowdarts',
          'Some species carry their tadpoles on their backs'
        ],
        sounds: ['chirp', 'buzz', 'trill'],
        behaviors: ['territorial display', 'parental care', 'diurnal activity'],
        adaptations: ['toxic skin', 'bright warning colors', 'climbing abilities', 'excellent vision']
      },
      {
        id: 'octopus',
        name: 'Giant Pacific Octopus',
        species: 'Enteroctopus dofleini',
        habitat: 'Pacific Ocean coastal waters',
        diet: 'carnivore',
        size: 'giant',
        lifespan: 5,
        conservationStatus: 'least concern',
        funFacts: [
          'Octopuses have three hearts and blue blood',
          'They can change color and texture in seconds',
          'Octopuses are highly intelligent and can solve puzzles'
        ],
        sounds: ['silent', 'water movement'],
        behaviors: ['camouflage', 'tool use', 'escape artistry'],
        adaptations: ['eight flexible arms', 'suckers with taste receptors', 'ink defense', 'excellent problem-solving']
      },
      {
        id: 'polar-bear',
        name: 'Polar Bear',
        species: 'Ursus maritimus',
        habitat: 'Arctic sea ice and coastal areas',
        diet: 'carnivore',
        size: 'giant',
        lifespan: 25,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Polar bears have black skin under their white fur',
          'They can smell seals from almost a mile away',
          'Polar bears are excellent swimmers and can swim for days'
        ],
        sounds: ['growl', 'roar', 'chuff'],
        behaviors: ['seal hunting', 'ice swimming', 'denning'],
        adaptations: ['thick blubber', 'water-repellent fur', 'large paws for swimming', 'excellent sense of smell']
      },
      {
        id: 'wolf',
        name: 'Gray Wolf',
        species: 'Canis lupus',
        habitat: 'Forests, tundra, deserts, and grasslands',
        diet: 'carnivore',
        size: 'large',
        lifespan: 13,
        conservationStatus: 'least concern',
        funFacts: [
          'Wolves have an incredible sense of smell 100 times stronger than humans',
          'They can run up to 65 km/h (40 mph)',
          'Wolf packs have complex social hierarchies'
        ],
        sounds: ['howl', 'growl', 'bark'],
        behaviors: ['pack hunting', 'territorial marking', 'social bonding'],
        adaptations: ['strong jaws', 'excellent sense of smell', 'endurance running', 'cooperative hunting']
      },
      {
        id: 'hippo',
        name: 'Hippopotamus',
        species: 'Hippopotamus amphibius',
        habitat: 'Rivers, lakes, and swamps in sub-Saharan Africa',
        diet: 'herbivore',
        size: 'giant',
        lifespan: 50,
        conservationStatus: 'vulnerable',
        funFacts: [
          'Hippos can open their mouths 150 degrees wide',
          'They secrete a red oily substance that acts as sunscreen',
          'Hippos are one of Africa\'s most dangerous animals'
        ],
        sounds: ['grunt', 'roar', 'wheeze'],
        behaviors: ['aquatic living', 'territorial defense', 'mud bathing'],
        adaptations: ['massive jaws', 'thick skin', 'eyes and ears on top of head', 'webbed feet']
      },
      {
        id: 'flamingo',
        name: 'American Flamingo',
        species: 'Phoenicopterus ruber',
        habitat: 'Caribbean, South America, and Galápagos Islands',
        diet: 'omnivore',
        size: 'large',
        lifespan: 40,
        conservationStatus: 'least concern',
        funFacts: [
          'Flamingos get their pink color from the food they eat',
          'They sleep standing on one leg',
          'Flamingo chicks are born gray and white'
        ],
        sounds: ['honk', 'grumble', 'growl'],
        behaviors: ['filter feeding', 'one-legged standing', 'colony nesting'],
        adaptations: ['specially shaped beak', 'long legs for wading', 'pink feathers from diet', 'webbed feet']
      },
      {
        id: 'peacock',
        name: 'Indian Peafowl',
        species: 'Pavo cristatus',
        habitat: 'Forests and cultivated areas of India and Sri Lanka',
        diet: 'omnivore',
        size: 'large',
        lifespan: 20,
        conservationStatus: 'least concern',
        funFacts: [
          'Only males have the elaborate tail feathers',
          'Peacocks can fly despite their large tails',
          'Their tail feathers can have up to 150 \"eyespot\" patterns'
        ],
        sounds: ['scream', 'hoot', 'bugle'],
        behaviors: ['courtship display', 'roosting in trees', 'foraging'],
        adaptations: ['elaborate tail feathers', 'iridescent colors', 'strong legs', 'flying ability']
      },
      {
        id: 'tiger',
        name: 'Bengal Tiger',
        species: 'Panthera tigris tigris',
        habitat: 'Forests and grasslands of India and Bangladesh',
        diet: 'carnivore',
        size: 'giant',
        lifespan: 15,
        conservationStatus: 'endangered',
        funFacts: [
          'Tigers are excellent swimmers and love water',
          'No two tigers have the same stripe pattern',
          'They can eat up to 40 kg (88 lbs) of meat in one meal'
        ],
        sounds: ['roar', 'growl', 'purr'],
        behaviors: ['ambush hunting', 'marking territory', 'solitary living'],
        adaptations: ['night vision', 'powerful muscles', 'sharp claws', 'camouflage stripes']
      },
      {
        id: 'monkey',
        name: 'Capuchin Monkey',
        species: 'Cebus imitator',
        habitat: 'Central and South American tropical forests',
        diet: 'omnivore',
        size: 'small',
        lifespan: 40,
        conservationStatus: 'least concern',
        funFacts: [
          'Capuchins use tools to crack open nuts',
          'They rub millipedes on their fur as insect repellent',
          'These monkeys are very intelligent and can learn sign language'
        ],
        sounds: ['chatter', 'scream', 'whistle'],
        behaviors: ['tool use', 'social grooming', 'tree climbing'],
        adaptations: ['prehensile tail', 'opposable thumbs', 'large brain', 'agile body']
      },
      {
        id: 'snake',
        name: 'King Cobra',
        species: 'Ophiophagus hannah',
        habitat: 'Forests of Southeast Asia and India',
        diet: 'carnivore',
        size: 'large',
        lifespan: 20,
        conservationStatus: 'vulnerable',
        funFacts: [
          'King cobras can grow up to 18 feet (5.5 meters) long',
          'They are the only snakes that build nests for their eggs',
          'Their venom is strong enough to kill an elephant'
        ],
        sounds: ['hiss', 'growl'],
        behaviors: ['hood display', 'nest building', 'hunting other snakes'],
        adaptations: ['flexible jaws', 'venom fangs', 'heat-sensing pits', 'hood for intimidation']
      },
      {
        id: 'bat',
        name: 'Fruit Bat',
        species: 'Pteropus spp.',
        habitat: 'Tropical and subtropical forests',
        diet: 'herbivore',
        size: 'medium',
        lifespan: 30,
        conservationStatus: 'varies by species',
        funFacts: [
          'Fruit bats are important pollinators for many plants',
          'They can travel up to 50 miles in one night',
          'Some species have wingspans up to 5 feet wide'
        ],
        sounds: ['squeak', 'click', 'screech'],
        behaviors: ['fruit eating', 'roosting in colonies', 'long distance flight'],
        adaptations: ['echolocation (some species)', 'large eyes', 'climbing claws', 'membranous wings']
      },
      {
        id: 'sloth',
        name: 'Three-toed Sloth',
        species: 'Bradypus variegatus',
        habitat: 'Central and South American rainforest canopies',
        diet: 'herbivore',
        size: 'medium',
        lifespan: 30,
        conservationStatus: 'least concern',
        funFacts: [
          'Sloths are so slow that algae grows on their fur',
          'They only come down from trees once a week to defecate',
          'Sloths can turn their heads 270 degrees'
        ],
        sounds: ['bleat', 'hiss', 'squeak'],
        behaviors: ['hanging upside down', 'slow movement', 'camouflaging with algae'],
        adaptations: ['long claws for hanging', 'slow metabolism', 'extra neck vertebrae', 'algae symbiosis']
      },
      {
        id: 'armadillo',
        name: 'Nine-banded Armadillo',
        species: 'Dasypus novemcinctus',
        habitat: 'Grasslands and forests of the Americas',
        diet: 'omnivore',
        size: 'medium',
        lifespan: 15,
        conservationStatus: 'least concern',
        funFacts: [
          'Armadillos always give birth to identical quadruplets',
          'They can hold their breath for up to 6 minutes',
          'Armadillos can jump 3-4 feet straight up in the air'
        ],
        sounds: ['grunt', 'squeak', 'wheeze'],
        behaviors: ['digging', 'rolling into ball', 'swimming'],
        adaptations: ['armored shell', 'sharp claws for digging', 'long sticky tongue', 'good sense of smell']
      },
      {
        id: 'narwhal',
        name: 'Narwhal',
        species: 'Monodon monoceros',
        habitat: 'Arctic waters around Greenland, Canada, and Russia',
        diet: 'carnivore',
        size: 'large',
        lifespan: 50,
        conservationStatus: 'near threatened',
        funFacts: [
          'The narwhal\'s tusk is actually a giant tooth that can grow 10 feet long',
          'They can dive up to 1,500 meters (4,900 feet) deep',
          'Narwhals are called the \"unicorns of the sea\"'
        ],
        sounds: ['click', 'whistle', 'bang'],
        behaviors: ['deep diving', 'tusk use', 'migrating'],
        adaptations: ['helical tusk', 'thick blubber', 'ability to dive deep', 'echolocation']
      },
      {
        id: 'bee',
        name: 'Honey Bee',
        species: 'Apis mellifera',
        habitat: 'Worldwide except Antarctica',
        diet: 'herbivore',
        size: 'small',
        lifespan: '6 weeks (workers), 2-5 years (queens)',
        conservationStatus: 'least concern',
        funFacts: [
          'Bees communicate through dancing',
          'A single bee produces about 1/12 teaspoon of honey in its lifetime',
          'Bees are essential pollinators for many crops'
        ],
        sounds: ['buzz', 'hum', 'vibrate'],
        behaviors: ['waggle dance', 'pollen collection', 'hive building'],
        adaptations: ['compound eyes', 'pollen baskets', 'stinger', 'wax production']
      }
    ];
  }

  public getAllAnimals(): Animal[] {
    return [...this.animals];
  }

  public getAnimalById(id: string): Animal | undefined {
    return this.animals.find(animal => animal.id === id);
  }

  public getAnimalsByHabitat(habitat: string): Animal[] {
    return this.animals.filter(animal =>
      animal.habitat.toLowerCase().includes(habitat.toLowerCase())
    );
  }

  public getAnimalsByDiet(diet: Animal['diet']): Animal[] {
    return this.animals.filter(animal => animal.diet === diet);
  }

  public getAnimalsByConservationStatus(status: Animal['conservationStatus']): Animal[] {
    return this.animals.filter(animal => animal.conservationStatus === status);
  }

  public getRandomAnimals(count: number): Animal[] {
    const shuffled = [...this.animals].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  public searchAnimals(query: string): Animal[] {
    const lowercaseQuery = query.toLowerCase();
    return this.animals.filter(animal =>
      animal.name.toLowerCase().includes(lowercaseQuery) ||
      animal.species.toLowerCase().includes(lowercaseQuery) ||
      animal.habitat.toLowerCase().includes(lowercaseQuery) ||
      animal.funFacts.some(fact => fact.toLowerCase().includes(lowercaseQuery))
    );
  }

  public getAnimalsBySize(size: Animal['size']): Animal[] {
    return this.animals.filter(animal => animal.size === size);
  }

  public getEndangeredAnimals(): Animal[] {
    return this.animals.filter(animal =>
      ['endangered', 'critically endangered', 'vulnerable'].includes(animal.conservationStatus)
    );
  }

  public getAnimalSounds(): { [key: string]: string[] } {
    const sounds: { [key: string]: string[] } = {};
    this.animals.forEach(animal => {
      sounds[animal.id] = animal.sounds;
    });
    return sounds;
  }
}