import { AnimalDatabase } from './animalDatabase';
import { Animal } from '../types/animalGame';

describe('AnimalDatabase', () => {
  let animalDatabase: AnimalDatabase;

  beforeEach(() => {
    // Clear any existing instance
    (AnimalDatabase as any).instance = null;
    animalDatabase = AnimalDatabase.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AnimalDatabase.getInstance();
      const instance2 = AnimalDatabase.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Animal Data Initialization', () => {
    it('should initialize with animals', () => {
      const animals = animalDatabase.getAllAnimals();
      expect(animals.length).toBeGreaterThan(0);
      expect(animals.length).toBe(10); // Based on our mock data
    });

    it('should have all required animal properties', () => {
      const animals = animalDatabase.getAllAnimals();
      const firstAnimal = animals[0];

      expect(firstAnimal).toHaveProperty('id');
      expect(firstAnimal).toHaveProperty('name');
      expect(firstAnimal).toHaveProperty('species');
      expect(firstAnimal).toHaveProperty('habitat');
      expect(firstAnimal).toHaveProperty('diet');
      expect(firstAnimal).toHaveProperty('size');
      expect(firstAnimal).toHaveProperty('lifespan');
      expect(firstAnimal).toHaveProperty('conservationStatus');
      expect(firstAnimal).toHaveProperty('funFacts');
      expect(firstAnimal).toHaveProperty('sounds');
      expect(firstAnimal).toHaveProperty('behaviors');
      expect(firstAnimal).toHaveProperty('adaptations');
    });

    it('should have valid conservation status values', () => {
      const animals = animalDatabase.getAllAnimals();
      const validStatuses = ['least concern', 'near threatened', 'vulnerable', 'endangered', 'critically endangered'];

      animals.forEach(animal => {
        expect(validStatuses).toContain(animal.conservationStatus);
      });
    });

    it('should have valid diet values', () => {
      const animals = animalDatabase.getAllAnimals();
      const validDiets = ['herbivore', 'carnivore', 'omnivore'];

      animals.forEach(animal => {
        expect(validDiets).toContain(animal.diet);
      });
    });

    it('should have valid size values', () => {
      const animals = animalDatabase.getAllAnimals();
      const validSizes = ['small', 'medium', 'large', 'giant'];

      animals.forEach(animal => {
        expect(validSizes).toContain(animal.size);
      });
    });
  });

  describe('Get Animal By ID', () => {
    it('should return correct animal by ID', () => {
      const lion = animalDatabase.getAnimalById('lion');
      expect(lion).toBeDefined();
      expect(lion?.name).toBe('Lion');
      expect(lion?.species).toBe('Panthera leo');
    });

    it('should return undefined for non-existent ID', () => {
      const nonExistent = animalDatabase.getAnimalById('non-existent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Get Animals By Habitat', () => {
    it('should return animals matching habitat', () => {
      const africanAnimals = animalDatabase.getAnimalsByHabitat('African');
      expect(africanAnimals.length).toBeGreaterThan(0);

      africanAnimals.forEach(animal => {
        expect(animal.habitat.toLowerCase()).toContain('african');
      });
    });

    it('should return empty array for non-existent habitat', () => {
      const noAnimals = animalDatabase.getAnimalsByHabitat('non-existent-habitat');
      expect(noAnimals).toEqual([]);
    });
  });

  describe('Get Animals By Diet', () => {
    it('should return correct animals for each diet type', () => {
      const herbivores = animalDatabase.getAnimalsByDiet('herbivore');
      const carnivores = animalDatabase.getAnimalsByDiet('carnivore');
      const omnivores = animalDatabase.getAnimalsByDiet('omnivore');

      expect(herbivores.length).toBeGreaterThan(0);
      expect(carnivores.length).toBeGreaterThan(0);
      expect(omnivores.length).toBeGreaterThan(0);

      herbivores.forEach(animal => {
        expect(animal.diet).toBe('herbivore');
      });

      carnivores.forEach(animal => {
        expect(animal.diet).toBe('carnivore');
      });

      omnivores.forEach(animal => {
        expect(animal.diet).toBe('omnivore');
      });
    });
  });

  describe('Get Animals By Conservation Status', () => {
    it('should return animals with matching conservation status', () => {
      const endangeredAnimals = animalDatabase.getAnimalsByConservationStatus('endangered');
      expect(endangeredAnimals.length).toBeGreaterThan(0);

      endangeredAnimals.forEach(animal => {
        expect(animal.conservationStatus).toBe('endangered');
      });
    });
  });

  describe('Get Random Animals', () => {
    it('should return requested number of random animals', () => {
      const randomAnimals = animalDatabase.getRandomAnimals(3);
      expect(randomAnimals.length).toBe(3);

      const randomAnimals5 = animalDatabase.getRandomAnimals(5);
      expect(randomAnimals5.length).toBe(5);
    });

    it('should not return more animals than available', () => {
      const totalAnimals = animalDatabase.getAllAnimals().length;
      const allAnimals = animalDatabase.getRandomAnimals(totalAnimals + 5);
      expect(allAnimals.length).toBe(totalAnimals);
    });

    it('should return unique animals', () => {
      const randomAnimals = animalDatabase.getRandomAnimals(5);
      const uniqueIds = new Set(randomAnimals.map(animal => animal.id));
      expect(uniqueIds.size).toBe(randomAnimals.length);
    });
  });

  describe('Search Animals', () => {
    it('should search by animal name', () => {
      const results = animalDatabase.searchAnimals('Lion');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Lion');
    });

    it('should search by species name', () => {
      const results = animalDatabase.searchAnimals('Panthera leo');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].species).toBe('Panthera leo');
    });

    it('should search by habitat', () => {
      const results = animalDatabase.searchAnimals('African');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(animal => {
        expect(animal.habitat.toLowerCase()).toContain('african');
      });
    });

    it('should search by fun facts', () => {
      const results = animalDatabase.searchAnimals('roar');
      expect(results.length).toBeGreaterThan(0);
      // Should find animals with "roar" in their fun facts
    });

    it('should return empty array for no matches', () => {
      const results = animalDatabase.searchAnimals('non-existent-search-term');
      expect(results).toEqual([]);
    });

    it('should be case insensitive', () => {
      const lowercase = animalDatabase.searchAnimals('lion');
      const uppercase = animalDatabase.searchAnimals('LION');
      const mixed = animalDatabase.searchAnimals('LiOn');

      expect(lowercase.length).toBeGreaterThan(0);
      expect(uppercase.length).toBe(lowercase.length);
      expect(mixed.length).toBe(lowercase.length);
    });
  });

  describe('Get Animals By Size', () => {
    it('should return animals by size category', () => {
      const smallAnimals = animalDatabase.getAnimalsBySize('small');
      const mediumAnimals = animalDatabase.getAnimalsBySize('medium');
      const largeAnimals = animalDatabase.getAnimalsBySize('large');
      const giantAnimals = animalDatabase.getAnimalsBySize('giant');

      expect(smallAnimals.length).toBeGreaterThan(0);
      expect(mediumAnimals.length).toBeGreaterThan(0);
      expect(largeAnimals.length).toBeGreaterThan(0);
      expect(giantAnimals.length).toBeGreaterThan(0);

      smallAnimals.forEach(animal => {
        expect(animal.size).toBe('small');
      });

      mediumAnimals.forEach(animal => {
        expect(animal.size).toBe('medium');
      });
    });
  });

  describe('Get Endangered Animals', () => {
    it('should return only endangered and critically endangered animals', () => {
      const endangeredAnimals = animalDatabase.getEndangeredAnimals();
      expect(endangeredAnimals.length).toBeGreaterThan(0);

      endangeredAnimals.forEach(animal => {
        expect(['endangered', 'critically endangered', 'vulnerable']).toContain(animal.conservationStatus);
      });
    });
  });

  describe('Get Animal Sounds', () => {
    it('should return sounds for all animals', () => {
      const sounds = animalDatabase.getAnimalSounds();
      expect(Object.keys(sounds).length).toBeGreaterThan(0);

      // Check that each animal has sounds
      Object.keys(sounds).forEach(animalId => {
        expect(Array.isArray(sounds[animalId])).toBe(true);
        expect(sounds[animalId].length).toBeGreaterThan(0);
      });
    });

    it('should include lion sounds', () => {
      const sounds = animalDatabase.getAnimalSounds();
      expect(sounds['lion']).toBeDefined();
      expect(sounds['lion']).toContain('roar');
    });
  });

  describe('Data Integrity', () => {
    it('should have valid lifespans', () => {
      const animals = animalDatabase.getAllAnimals();

      animals.forEach(animal => {
        expect(animal.lifespan).toBeGreaterThan(0);
        expect(Number.isInteger(animal.lifespan)).toBe(true);
      });
    });

    it('should have non-empty fun facts', () => {
      const animals = animalDatabase.getAllAnimals();

      animals.forEach(animal => {
        expect(animal.funFacts.length).toBeGreaterThan(0);
        animal.funFacts.forEach(fact => {
          expect(fact.trim().length).toBeGreaterThan(0);
        });
      });
    });

    it('should have non-empty behaviors', () => {
      const animals = animalDatabase.getAllAnimals();

      animals.forEach(animal => {
        expect(animal.behaviors.length).toBeGreaterThan(0);
        animal.behaviors.forEach(behavior => {
          expect(behavior.trim().length).toBeGreaterThan(0);
        });
      });
    });

    it('should have non-empty adaptations', () => {
      const animals = animalDatabase.getAllAnimals();

      animals.forEach(animal => {
        expect(animal.adaptations.length).toBeGreaterThan(0);
        animal.adaptations.forEach(adaptation => {
          expect(adaptation.trim().length).toBeGreaterThan(0);
        });
      });
    });

    it('should have non-empty sounds', () => {
      const animals = animalDatabase.getAllAnimals();

      animals.forEach(animal => {
        expect(animal.sounds.length).toBeGreaterThan(0);
        animal.sounds.forEach(sound => {
          expect(sound.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });
});