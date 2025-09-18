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