import { Animal, AnimalQuestion } from '../types/animalGame';
import { AnimalDatabase } from './animalDatabase';

export class AnimalQuestionGenerator {
  private static instance: AnimalQuestionGenerator;
  private animalDatabase: AnimalDatabase;

  private constructor() {
    this.animalDatabase = AnimalDatabase.getInstance();
  }

  public static getInstance(): AnimalQuestionGenerator {
    if (!AnimalQuestionGenerator.instance) {
      AnimalQuestionGenerator.instance = new AnimalQuestionGenerator();
    }
    return AnimalQuestionGenerator.instance;
  }

  public generateQuestion(animal: Animal, type: AnimalQuestion['type'], difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const questionGenerators = {
      identification: this.generateIdentificationQuestion,
      habitat: this.generateHabitatQuestion,
      diet: this.generateDietQuestion,
      behavior: this.generateBehaviorQuestion,
      adaptation: this.generateAdaptationQuestion,
      conservation: this.generateConservationQuestion,
      'fun-fact': this.generateFunFactQuestion
    };

    return questionGenerators[type](animal, difficulty);
  }

  private generateIdentificationQuestion(animal: Animal, difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const difficultyConfig = {
      easy: { options: this.getOtherAnimals(animal, 3), includeSpecies: false },
      medium: { options: this.getOtherAnimals(animal, 4), includeSpecies: true },
      hard: { options: this.getOtherAnimals(animal, 5), includeSpecies: true },
      expert: { options: this.getOtherAnimals(animal, 6), includeSpecies: true }
    };

    const config = difficultyConfig[difficulty];
    const allOptions = [animal.name, ...config.options.map(a => a.name)];
    const shuffledOptions = this.shuffleArray(allOptions);

    return {
      id: `identification-${animal.id}-${Date.now()}`,
      type: 'identification',
      difficulty,
      question: config.includeSpecies
        ? `What animal is scientifically known as ${animal.species}?`
        : `What animal has these characteristics: lives in ${animal.habitat}, is a ${animal.diet}, and is ${animal.size} in size?`,
      options: shuffledOptions,
      correctAnswer: animal.name,
      explanation: `${animal.name} is a ${animal.size} ${animal.diet} that lives in ${animal.habitat}.`,
      animal
    };
  }

  private generateHabitatQuestion(animal: Animal, difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const difficultyConfig = {
      easy: { options: ['Ocean', 'Forest', 'Desert', 'Arctic'] },
      medium: { options: ['African savanna', 'Amazon rainforest', 'Arctic tundra', 'Coral reef', 'Mountains'] },
      hard: { options: ['African savanna and grasslands', 'Amazon rainforest canopy', 'Deep ocean waters', 'Arctic ice sheets', 'Mountain forests'] },
      expert: { options: ['African savanna, grasslands and open woodlands', 'Tropical and temperate rainforest canopies', 'Deep ocean waters and continental shelves', 'Arctic ice packs and surrounding waters', 'High altitude mountain forests and slopes'] }
    };

    const config = difficultyConfig[difficulty];
    const correctHabitat = animal.habitat;
    const allOptions = this.shuffleArray([correctHabitat, ...this.getWrongHabitats(config.options.length - 1, correctHabitat)]);

    return {
      id: `habitat-${animal.id}-${Date.now()}`,
      type: 'habitat',
      difficulty,
      question: `Where does the ${animal.name} naturally live?`,
      options: allOptions,
      correctAnswer: correctHabitat,
      explanation: `${animal.name}s are naturally found in ${animal.habitat}.`,
      animal
    };
  }

  private generateDietQuestion(animal: Animal, difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const dietDescriptions = {
      herbivore: 'eats only plants and vegetation',
      carnivore: 'eats only other animals',
      omnivore: 'eats both plants and animals'
    };

    const difficultyConfig = {
      easy: { options: ['Plants only', 'Meat only', 'Both plants and meat'] },
      medium: { options: ['Herbivore', 'Carnivore', 'Omnivore'] },
      hard: { options: ['Only plants and vegetation', 'Only other animals', 'Both plants and animals'] },
      expert: { options: ['Strictly herbivorous - plant matter only', 'Strictly carnivorous - other animals only', 'Omnivorous - both plant and animal matter'] }
    };

    const config = difficultyConfig[difficulty];
    const correctAnswer = config.options[animal.diet === 'herbivore' ? 0 : animal.diet === 'carnivore' ? 1 : 2];
    const allOptions = this.shuffleArray(config.options);

    return {
      id: `diet-${animal.id}-${Date.now()}`,
      type: 'diet',
      difficulty,
      question: `What type of diet does the ${animal.name} have?`,
      options: allOptions,
      correctAnswer,
      explanation: `The ${animal.name} is a ${animal.diet}, which means it ${dietDescriptions[animal.diet]}.`,
      animal
    };
  }

  private generateBehaviorQuestion(animal: Animal, difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const difficultyConfig = {
      easy: {
        questions: [
          `What is a common behavior of ${animal.name}s?`,
          `Which activity do ${animal.name}s regularly do?`
        ],
        answerType: 'simple',
        optionCount: 3
      },
      medium: {
        questions: [
          `Which of these behaviors is characteristic of ${animal.name}s?`,
          `What makes ${animal.name} behavior unique?`
        ],
        answerType: 'detailed',
        optionCount: 4
      },
      hard: {
        questions: [
          `Which complex behavior do ${animal.name}s exhibit in their natural habitat?`,
          `How do ${animal.name}s adapt their behavior to their environment?`
        ],
        answerType: 'complex',
        optionCount: 5
      },
      expert: {
        questions: [
          `Which specialized behavior demonstrates the ${animal.name}'s evolutionary adaptations?`,
          `How do ${animal.name} behaviors contribute to their ecological niche?`
        ],
        answerType: 'expert',
        optionCount: 6
      }
    };

    const config = difficultyConfig[difficulty];
    const correctBehavior = animal.behaviors[Math.floor(Math.random() * animal.behaviors.length)];
    const allOptions = this.shuffleArray([correctBehavior, ...this.getWrongBehaviors(animal, config.optionCount - 1)]);

    return {
      id: `behavior-${animal.id}-${Date.now()}`,
      type: 'behavior',
      difficulty,
      question: config.questions[Math.floor(Math.random() * config.questions.length)],
      options: allOptions,
      correctAnswer: correctBehavior,
      explanation: `${animal.name}s are known for ${correctBehavior}, which is essential for their survival and lifestyle.`,
      animal
    };
  }

  private generateAdaptationQuestion(animal: Animal, difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const difficultyConfig = {
      easy: {
        questions: [
          `What special feature helps ${animal.name}s survive?`,
          `Which adaptation is important for ${animal.name}s?`
        ],
        optionCount: 3
      },
      medium: {
        questions: [
          `Which physical adaptation helps the ${animal.name} in its habitat?`,
          `What special characteristic does the ${animal.name} have?`
        ],
        optionCount: 4
      },
      hard: {
        questions: [
          `Which specialized adaptation allows ${animal.name}s to thrive in their environment?`,
          `What evolutionary advantage does this adaptation give ${animal.name}s?`
        ],
        optionCount: 5
      },
      expert: {
        questions: [
          `Which sophisticated adaptation demonstrates the ${animal.name}'s evolutionary specialization?`,
          `How does this adaptation contribute to the ${animal.name}'s survival in challenging conditions?`
        ],
        optionCount: 6
      }
    };

    const config = difficultyConfig[difficulty];
    const correctAdaptation = animal.adaptations[Math.floor(Math.random() * animal.adaptations.length)];
    const allOptions = this.shuffleArray([correctAdaptation, ...this.getWrongAdaptations(animal, config.optionCount - 1)]);

    return {
      id: `adaptation-${animal.id}-${Date.now()}`,
      type: 'adaptation',
      difficulty,
      question: config.questions[Math.floor(Math.random() * config.questions.length)],
      options: allOptions,
      correctAnswer: correctAdaptation,
      explanation: `The ${correctAdaptation.toLowerCase()} is a crucial adaptation that helps ${animal.name}s survive in ${animal.habitat}.`,
      animal
    };
  }

  private generateConservationQuestion(animal: Animal, difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const conservationDescriptions = {
      'least concern': 'species is widespread and abundant',
      'near threatened': 'species is close to becoming threatened',
      'vulnerable': 'species faces high risk of extinction in the wild',
      'endangered': 'species faces very high risk of extinction in the wild',
      'critically endangered': 'species faces extremely high risk of extinction in the wild'
    };

    const difficultyConfig = {
      easy: { options: ['Safe', 'At risk', 'Endangered', 'Extinct'] },
      medium: { options: ['Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered'] },
      hard: { options: ['Least concern', 'Near threatened', 'Vulnerable', 'Endangered', 'Critically endangered', 'Extinct in the wild'] },
      expert: { options: ['Least Concern - widespread and abundant', 'Near Threatened - close to being threatened', 'Vulnerable - high risk of extinction', 'Endangered - very high risk of extinction', 'Critically Endangered - extremely high risk of extinction'] }
    };

    const config = difficultyConfig[difficulty];
    const correctAnswer = config.options[[
      'least concern', 'near threatened', 'vulnerable', 'endangered', 'critically endangered'
    ].indexOf(animal.conservationStatus)];

    const allOptions = this.shuffleArray(config.options);

    return {
      id: `conservation-${animal.id}-${Date.now()}`,
      type: 'conservation',
      difficulty,
      question: `What is the conservation status of the ${animal.name}?`,
      options: allOptions,
      correctAnswer,
      explanation: `The ${animal.name} is classified as ${animal.conservationStatus}, which means ${conservationDescriptions[animal.conservationStatus]}.`,
      animal
    };
  }

  private generateFunFactQuestion(animal: Animal, difficulty: AnimalQuestion['difficulty']): AnimalQuestion {
    const funFact = animal.funFacts[Math.floor(Math.random() * animal.funFacts.length)];

    const difficultyConfig = {
      easy: { trueFalse: true, optionCount: 2 },
      medium: { trueFalse: false, partialFact: false, optionCount: 4 },
      hard: { trueFalse: false, partialFact: true, optionCount: 5 },
      expert: { trueFalse: false, partialFact: true, optionCount: 6 }
    };

    const config = difficultyConfig[difficulty];

    if (config.trueFalse) {
      const isTrue = Math.random() > 0.5;
      const statement = isTrue ? funFact : this.generateFalseFact(animal);

      return {
        id: `funfact-${animal.id}-${Date.now()}`,
        type: 'fun-fact',
        difficulty,
        question: `True or False: ${statement}`,
        options: ['True', 'False'],
        correctAnswer: isTrue ? 'True' : 'False',
        explanation: isTrue ? `That's correct! ${funFact}` : `Actually, ${funFact}`,
        animal
      };
    } else {
      const partialFact = this.generatePartialFact(funFact, animal);
      const allOptions = this.shuffleArray([funFact, partialFact, ...this.getWrongFacts(animal, config.optionCount - 2)]);

      return {
        id: `funfact-${animal.id}-${Date.now()}`,
        type: 'fun-fact',
        difficulty,
        question: `Which of these is true about ${animal.name}s?`,
        options: allOptions,
        correctAnswer: funFact,
        explanation: `That's right! ${funFact}`,
        animal
      };
    }
  }

  private getOtherAnimals(excludeAnimal: Animal, count: number): Animal[] {
    const allAnimals = this.animalDatabase.getAllAnimals();
    const otherAnimals = allAnimals.filter(animal => animal.id !== excludeAnimal.id);
    return this.shuffleArray(otherAnimals).slice(0, count);
  }

  private getWrongHabitats(count: number, excludeHabitat: string): string[] {
    const habitats = [
      'African savanna', 'Amazon rainforest', 'Arctic tundra', 'Coral reef', 'Mountains',
      'Ocean waters', 'Forests', 'Deserts', 'Grasslands', 'Wetlands'
    ].filter(h => h !== excludeHabitat);
    return this.shuffleArray(habitats).slice(0, count);
  }

  private getWrongBehaviors(animal: Animal, count: number): string[] {
    const allBehaviors = [
      'flying', 'swimming', 'climbing', 'digging', 'jumping', 'running',
      'hunting', 'grazing', 'migrating', 'hibernating', 'nesting', 'burrowing'
    ].filter(b => !animal.behaviors.includes(b));
    return this.shuffleArray(allBehaviors).slice(0, count);
  }

  private getWrongAdaptations(animal: Animal, count: number): string[] {
    const allAdaptations = [
      'wings', 'gills', 'scales', 'fur', 'feathers', 'shell', 'horns',
      'trunk', 'tentacles', 'poison', 'spikes', 'camouflage', 'bioluminescence'
    ].filter(a => !animal.adaptations.includes(a));
    return this.shuffleArray(allAdaptations).slice(0, count);
  }

  private getWrongFacts(animal: Animal, count: number): string[] {
    const wrongFacts = [
      `They can live for 100 years`,
      `They weigh over 1000 pounds`,
      `They can fly at speeds up to 100 mph`,
      `They hibernate for 6 months`,
      `They can change color instantly`,
      `They have three hearts`
    ];
    return this.shuffleArray(wrongFacts).slice(0, count);
  }

  private generateFalseFact(animal: Animal): string {
    const falseTemplates = [
      `${animal.name}s can fly`,
      `${animal.name}s live for 100 years`,
      `All ${animal.name}s are poisonous`,
      `${animal.name}s can change color`,
      `${animal.name}s hibernate underground`
    ];
    return falseTemplates[Math.floor(Math.random() * falseTemplates.length)];
  }

  private generatePartialFact(correctFact: string, animal: Animal): string {
    // Generate a partially correct but ultimately wrong fact
    return `Some people believe ${correctFact.toLowerCase().substring(0, 20)}... but this is not entirely accurate.`;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}