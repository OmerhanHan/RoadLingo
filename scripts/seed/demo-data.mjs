/**
 * Fake work for the demo account (see scripts/seed-demo.mjs). Invented
 * essays and emails at real length; the scores are hand-written samples and
 * are saved as 'mock', so the app labels them as sample scores.
 *
 * `group` is not stored: it marks which essays share a theme, so the seed can
 * report how similar the vectors of related and unrelated essays are.
 * Emails copy their scenario's fields from src/lib/emailAnalysis.ts.
 * `daysAgo` spreads the work over the last weeks for the stats screens.
 */

export const WRITINGS = [
  // ── Education ──
  {
    key: 'edu-free-university',
    group: 'education',
    daysAgo: 27,
    mode: 'predetermined',
    topic: 'Some people believe that university education should be free for everyone. To what extent do you agree or disagree?',
    content: `In many countries, the cost of a university degree has risen so sharply that young people graduate with debts they cannot repay for decades. For this reason, I strongly agree that higher education should be free for every student who meets the academic requirements.

The main argument for free tuition is equal opportunity. When universities charge high fees, talented students from poor families often choose not to apply at all, even if their grades are excellent. As a result, the best positions in society go to those whose parents could afford to pay, not to the most capable people. Free education removes this barrier and allows a country to use the full potential of its young population.

Secondly, a well-educated workforce benefits the whole economy. Graduates usually earn higher salaries, pay more taxes and are less likely to need social support. In this sense, the money a government spends on tuition is not a cost but an investment that returns over time. Countries such as Germany and Finland, where public universities charge little or nothing, still have strong and innovative economies.

Of course, critics argue that free education places a heavy burden on taxpayers, and that some students may not take their studies seriously if they do not pay. However, these problems can be solved by setting clear academic standards and limiting the number of years a student can study for free.

In conclusion, although free university education requires careful planning and public funding, I believe its benefits for individuals and society are far greater than its costs.`,
    feedback: {
      band_score: 7.0,
      grammar_score: 8,
      coherence_score: 8,
      vocabulary_score: 7,
      grammar_errors: [],
      suggestions: [
        'Give one concrete figure (for example average student debt) to support the first paragraph.',
        'The counter-argument paragraph could explain more clearly how academic standards would work in practice.',
        'Vary linking words: "Secondly" and "In this sense" could be replaced with less common alternatives.',
      ],
      overall_comment:
        'A clear, well-organised essay with a consistent position. Arguments are relevant and supported with examples, and the counter-argument is addressed. More precise evidence would lift it further.',
    },
  },
  {
    key: 'edu-work-after-school',
    group: 'education',
    daysAgo: 22,
    mode: 'random',
    topic: 'Is it better for young people to go to university or to start working straight after high school?',
    content: `After finishing high school, many young people face an important decision: should they continue their education at university, or should they start working and earning money immediately? Both choices have advantages, but in my opinion going to university is the better option for most students.

First of all, a university degree opens doors that remain closed to people without one. Many professions, such as medicine, law and engineering, simply require a degree. Even in other fields, employers often prefer graduates because they believe a degree shows discipline and the ability to learn complex material. Therefore, a young person who skips university may find it difficult to move into a better position later.

In addition, university is not only about lectures and exams. Students meet people from different backgrounds, join clubs and learn to manage their own time. These experiences help them become independent adults and build a network of contacts which can be useful for their future career.

On the other hand, it is true that university is expensive and takes several years. Some students do not know what they want to study and they waste time and money on a subject they do not enjoy. For these people, working for a year or two can help them discover their interests before they make a decision.

To sum up, while starting work early can suit some people, I believe that for the majority, studying at university provides better long-term opportunities and personal growth.`,
    feedback: {
      band_score: 6.5,
      grammar_score: 7,
      coherence_score: 7,
      vocabulary_score: 6,
      grammar_errors: [
        {
          word: 'a network of contacts which can be useful',
          suggestion: 'a network of contacts that can be useful',
          explanation: 'In a defining relative clause, "that" is more natural than "which" without a comma.',
        },
      ],
      suggestions: [
        'Use more precise vocabulary instead of general phrases such as "opens doors" and "better position".',
        'The third paragraph could connect the social benefits more directly to the question.',
        'Add a specific example of a student or a profession to make the argument more convincing.',
      ],
      overall_comment:
        'The essay answers the question and has a logical structure. Ideas are clear but somewhat general, and the vocabulary is functional rather than precise.',
    },
  },
  {
    key: 'edu-outside-major',
    group: 'education',
    daysAgo: 9,
    mode: 'predetermined',
    topic: 'Should university students be required to take courses outside their main field of study?',
    content: `Many universities ask their students to take a number of courses that are not related to their major, for example an engineering student taking a history or philosophy class. Some people think this is a waste of time, but I believe that these requirements are valuable and should be kept.

The first reason is that courses outside the main subject help students to think in different ways. An engineer learns to solve technical problems, but a philosophy class teaches them how to build an argument and question their own assumptions. These skills are useful in any job, especially when a person needs to explain an idea to people who are not experts.

Another reason is that the modern job market changes very quickly. A student who only studies one narrow subject may find that their knowledge becomes outdated in a few years. Students who have a wider education are more flexible and can more easily move to a new field if they need to.

However, I understand why some students complain. University is expensive and time is limited, so they want to focus on the subjects that will help them get a job. For this reason, universities should keep the number of required outside courses small and allow students to choose from a wide range of options, so that the classes feel useful rather than forced.

In conclusion, I agree that students should take some courses outside their field, because a broader education produces more flexible and thoughtful graduates.`,
    feedback: {
      band_score: 7.0,
      grammar_score: 8,
      coherence_score: 7,
      vocabulary_score: 7,
      grammar_errors: [],
      suggestions: [
        'The concession paragraph is good; a short example of a successful elective programme would strengthen it.',
        'Some sentences start with "The first reason" / "Another reason"; try more varied paragraph openings.',
        'Replace "very quickly" with a stronger expression such as "rapidly" or "at an unprecedented pace".',
      ],
      overall_comment:
        'A balanced and well-reasoned answer with a clear position. Paragraphs are focused and the conclusion follows from the arguments.',
    },
  },

  // ── Technology and children ──
  {
    key: 'tech-social-media',
    group: 'technology',
    daysAgo: 25,
    mode: 'random',
    topic: 'Has social media made people less social?',
    content: `Social media platforms such as Instagram and TikTok are now part of daily life for billions of people. They were designed to connect us, but many people argue that they have actually made us less social. In my view, social media has changed the way we communicate, and in many cases it has weakened real relationships.

One clear problem is that people spend hours scrolling through their phones instead of talking to the people around them. It is common to see a group of friends sitting at the same table in a café while each of them looks at a screen. Online interactions, like a quick comment or a heart, are easy, but they do not replace a long conversation where people really listen to each other.

Moreover, social media encourages people to compare themselves with others. Users usually share only the best moments of their lives, so their followers may feel that everyone else is happier or more successful. This can lead to loneliness and anxiety, especially among teenagers, and some people even avoid meeting others because they feel they are not good enough.

Nevertheless, social media also has benefits. It allows people to stay in touch with friends and relatives who live far away, and it helps people with rare interests to find communities they could never find in their own town.

In conclusion, social media is a useful tool, but when it replaces face-to-face contact, it makes people less social. We should use it to support our relationships, not to substitute them.`,
    feedback: {
      band_score: 6.5,
      grammar_score: 7,
      coherence_score: 7,
      vocabulary_score: 7,
      grammar_errors: [
        {
          word: 'not to substitute them',
          suggestion: 'not to replace them',
          explanation: '"Substitute" needs "for": "substitute it for something". "Replace" is correct here.',
        },
      ],
      suggestions: [
        'Support the claim about anxiety among teenagers with a study or a statistic.',
        'The benefits paragraph is short compared with the others; develop it with an example.',
        'Check collocations such as "substitute them"; small word choice errors lower the vocabulary score.',
      ],
      overall_comment:
        'A relevant and engaging essay with good examples from everyday life. The position is clear, but the balance between the two sides could be improved.',
    },
  },
  {
    key: 'tech-children-phones',
    group: 'technology',
    daysAgo: 16,
    mode: 'predetermined',
    topic: 'Should children under the age of 13 be allowed to have their own smartphones?',
    content: `Nowadays it is very common to see young children with their own smartphones. Parents often buy them a phone so that they can contact their children at any time. However, I believe that children under thirteen should not have their own smartphone, although a simple phone for calls can be acceptable.

The most important reason is that smartphones can be harmful for children's development. Many children spend several hours a day playing games or watching videos, and this time is taken away from sport, reading and playing with friends. Doctors also warn that using screens late at night affects children's sleep, which is important for their health and their performance at school.

Secondly, the internet contains a lot of content that is not suitable for children. Even with parental controls, it is very difficult to stop a child from seeing violent videos or talking to strangers in online games. Young children are not able to understand these dangers, so they can easily become victims of bullying or other problems.

On the other hand, parents worry about safety, and they want to know where their children are. This is a reasonable concern, but it does not require a smartphone. A basic phone which can only make calls and send messages gives parents the same security without the risks of the internet and social media.

In conclusion, I think children under thirteen should wait before getting a smartphone. Parents can protect their children better by giving them a simple phone and spending more time with them offline.`,
    feedback: {
      band_score: 6.0,
      grammar_score: 6,
      coherence_score: 7,
      vocabulary_score: 6,
      grammar_errors: [
        {
          word: 'harmful for children\'s development',
          suggestion: 'harmful to children\'s development',
          explanation: 'The usual preposition after "harmful" is "to".',
        },
        {
          word: 'it is very difficult to stop a child from seeing',
          suggestion: 'it is very difficult to prevent a child from seeing',
          explanation: 'Not wrong, but "prevent" is the more formal choice in an academic essay.',
        },
      ],
      suggestions: [
        'Avoid repeating "very" and "a lot of"; use more academic alternatives.',
        'Mention which doctors or which research warns about screen use at night.',
        'The introduction already gives the conclusion; keep the final paragraph from repeating it word for word.',
      ],
      overall_comment:
        'The essay presents a clear opinion with sensible reasons and a practical solution. Vocabulary is simple and some prepositions are inaccurate.',
    },
  },
  {
    key: 'tech-online-privacy',
    group: 'technology',
    daysAgo: 4,
    mode: 'random',
    topic: 'Technology companies collect a great deal of personal data. Should governments limit what they can collect?',
    content: `Every time we use a search engine, a map or a social media app, technology companies collect information about us. They know where we go, what we buy and even what we are interested in. In my opinion, governments should set strict limits on the personal data that these companies are allowed to collect.

Firstly, most users do not really understand what they agree to. Privacy policies are long and full of legal language, so people simply click "accept" without reading them. This means that companies can collect much more information than users would ever agree to if they understood the situation. Clear laws are needed to protect people who cannot defend themselves.

Secondly, collected data can be misused. There have been many cases in which personal information was stolen by hackers or sold to other companies. In some situations, data has even been used to influence how people vote. When so much power is in the hands of a few private companies, it becomes a danger for democracy as well as for individuals.

Some people argue that data collection allows companies to offer free services and better recommendations, and that strict rules would slow down innovation. However, regulations such as the European GDPR show that it is possible to protect privacy while technology companies continue to grow.

To conclude, personal data is valuable and sensitive, and individuals cannot control it on their own. Therefore, I believe governments have a responsibility to limit what technology companies collect and to punish those who break the rules.`,
    feedback: null,
  },

  // ── Environment ──
  {
    key: 'env-plastic-ban',
    group: 'environment',
    daysAgo: 26,
    mode: 'predetermined',
    topic: 'Should governments ban single-use plastic products?',
    content: `Plastic bags, straws and bottles are used for only a few minutes, but they can remain in the environment for hundreds of years. Because of the serious damage they cause, I believe governments should ban most single-use plastic products.

The strongest argument for a ban is the harm plastic does to nature. Millions of tonnes of plastic end up in the oceans every year, where they kill fish, birds and turtles that mistake them for food. Over time, plastic breaks into tiny pieces called microplastics, which have now been found in drinking water and even in human blood. The longer we wait, the bigger this problem becomes.

Furthermore, voluntary measures have not been enough. Many campaigns have asked people to bring their own bags or refuse plastic straws, but the amount of plastic waste has continued to grow. In contrast, countries that introduced a ban or a small charge on plastic bags saw their use fall dramatically within a few months. This shows that clear rules change behaviour much faster than advice.

Opponents claim that a ban would increase costs for businesses and consumers, and that some alternatives, such as paper bags, also have an environmental cost. These concerns are reasonable, so a ban should be introduced gradually and combined with support for reusable products.

In conclusion, single-use plastics cause long-lasting damage that individuals alone cannot solve. A carefully planned government ban is the most effective way to reduce this pollution.`,
    feedback: {
      band_score: 7.5,
      grammar_score: 8,
      coherence_score: 8,
      vocabulary_score: 8,
      grammar_errors: [],
      suggestions: [
        'Name one country and the percentage drop in plastic bag use to make the evidence concrete.',
        'The phrase "This shows that" is used well; vary similar signposts elsewhere.',
        'Consider one sentence on how the ban would be enforced.',
      ],
      overall_comment:
        'A strong, persuasive essay with precise vocabulary and good use of evidence. The counter-argument is handled maturely and the structure is clear throughout.',
    },
  },
  {
    key: 'env-climate-responsibility',
    group: 'environment',
    daysAgo: 18,
    mode: 'random',
    topic: 'Who should be mainly responsible for fighting climate change: individuals or governments?',
    content: `Climate change is one of the biggest challenges of our time, and there is a debate about who should take the main responsibility for solving it. Some people say that every individual must change their lifestyle, while others believe this is mainly the job of governments. In my view, governments must lead, but individuals also have an important role.

Governments have powers that individuals do not have. They can build public transport, invest in solar and wind energy and set limits on how much pollution factories can produce. A single law can reduce emissions more than millions of people recycling their bottles. For example, when a government closes coal power plants, the effect on the climate is enormous compared with the actions of one family.

In addition, many people cannot make greener choices because the options are too expensive or simply not available. A person living in a village without buses has no choice but to drive a car. Only governments can create the conditions that make environmentally friendly behaviour easy and affordable for everyone.

However, this does not mean that individuals have no responsibility. Governments in democratic countries respond to the wishes of their citizens, so people who care about the environment can vote for leaders with strong climate policies. Moreover, small actions like eating less meat or flying less, when they are done by millions of people, do make a difference.

In conclusion, governments should carry the main responsibility because they have the necessary power and resources, but individuals must support them through their votes and their daily choices.`,
    feedback: {
      band_score: 7.0,
      grammar_score: 7,
      coherence_score: 8,
      vocabulary_score: 7,
      grammar_errors: [
        {
          word: 'when they are done by millions of people, do make a difference',
          suggestion: 'when millions of people take them, do make a difference',
          explanation: 'The passive clause is a little awkward; an active clause reads more naturally.',
        },
      ],
      suggestions: [
        'The coal plant example is effective; add a similar concrete example for individual action.',
        'Use more topic-specific vocabulary such as "carbon footprint" or "emissions targets".',
        'The introduction could be shortened so the main argument starts sooner.',
      ],
      overall_comment:
        'A well-balanced essay with a clear thesis and logical progression. Examples are relevant and the conclusion summarises both sides effectively.',
    },
  },
  {
    key: 'env-cars-public-transport',
    group: 'environment',
    daysAgo: 7,
    mode: 'predetermined',
    topic: 'Some people think cities should ban private cars from their centres and invest in public transport instead. Do you agree?',
    content: `In many big cities, the streets are full of cars, the air is polluted and people spend hours in traffic every week. For this reason, several cities have started to close their centres to private cars. I agree that this is a good idea, as long as public transport is improved at the same time.

The first benefit of removing cars from city centres is cleaner air. Exhaust fumes are one of the main causes of air pollution, which leads to breathing problems and heart disease. When cars are replaced by buses, trams and bicycles, the level of harmful gases falls quickly, and the city becomes a healthier place to live.

Another advantage is that the centre becomes more pleasant for people. Streets that were once used for parking can be turned into parks, cafés and wide pavements. Shops often benefit as well, because pedestrians walk slowly and are more likely to stop and buy something than drivers who are passing through.

However, a ban only works if people have a real alternative. If buses are crowded, expensive or unreliable, people who need to travel to the centre will suffer, especially the elderly and people with disabilities. Therefore, the city must first invest in frequent, cheap public transport and safe cycle lanes, and allow exceptions for deliveries and emergency vehicles.

In conclusion, banning private cars from city centres can reduce pollution and make cities more liveable, but it must go together with a serious investment in public transport.`,
    feedback: {
      band_score: 6.5,
      grammar_score: 7,
      coherence_score: 7,
      vocabulary_score: 7,
      grammar_errors: [],
      suggestions: [
        'Mention a city that has done this (for example Oslo or Madrid) and what happened.',
        'The second paragraph could explain the economic benefit with more detail.',
        'Some sentences are long; split one or two for clarity.',
      ],
      overall_comment:
        'A clear and relevant response with a reasonable condition attached to the opinion. More specific examples would make the argument more convincing.',
    },
  },

  // ── Work ──
  {
    key: 'work-from-home',
    group: 'work',
    daysAgo: 20,
    mode: 'random',
    topic: 'Is working from home better than working in an office?',
    content: `Since the pandemic, millions of people have started working from home, and many of them do not want to return to the office. While remote work has clear advantages, I believe that a combination of home and office work is the best solution for most employees and companies.

Working from home saves a lot of time and money. Employees do not need to travel for an hour in crowded trains or pay for petrol and parking. They can use this time to rest, exercise or spend with their families, which often makes them happier and more productive. Companies can also save money because they need smaller offices.

On the other hand, working from home has some serious disadvantages. Many people find it difficult to separate their work from their private life, so they end up working late in the evening. Others feel lonely because they do not see their colleagues. New employees in particular learn much faster when they can sit next to experienced colleagues and ask questions directly.

Moreover, some types of work, such as brainstorming new ideas or solving complicated problems in a team, are easier when people are in the same room. Video calls are useful, but they cannot completely replace the informal conversations that happen in an office kitchen.

To sum up, both working from home and working in an office have strengths and weaknesses. A hybrid model, where employees spend a few days at home and a few days in the office, allows people to enjoy the benefits of both.`,
    feedback: {
      band_score: 6.0,
      grammar_score: 7,
      coherence_score: 6,
      vocabulary_score: 6,
      grammar_errors: [
        {
          word: 'spend with their families',
          suggestion: 'spend it with their families',
          explanation: '"Spend" needs an object here: "use this time to ... spend it with their families".',
        },
      ],
      suggestions: [
        'The question asks which is better; state the hybrid position in the introduction more directly.',
        'Paragraphs 3 and 4 both list disadvantages; merge or differentiate them.',
        'Replace "a lot of" and "some serious" with more precise expressions.',
      ],
      overall_comment:
        'The essay covers both sides and reaches a sensible conclusion. Organisation could be tighter and the vocabulary is mostly everyday.',
    },
  },
  {
    key: 'work-salary-satisfaction',
    group: 'work',
    daysAgo: 11,
    mode: 'predetermined',
    topic: 'Is a high salary more important than job satisfaction?',
    content: `When people choose a job, they often have to decide between a position that pays well and one that they really enjoy. Some believe that money is the most important factor, but in my opinion job satisfaction matters more in the long term, as long as the salary covers a person's basic needs.

People spend around forty hours a week at work, which is a large part of their lives. If they hate what they do, even a high salary cannot make them happy for long. Research in psychology shows that once people earn enough to live comfortably, additional money has only a small effect on their happiness. In contrast, meaningful work, good colleagues and a sense of progress have a strong influence on how satisfied people feel.

Furthermore, people who enjoy their work tend to perform better. They are more creative, more motivated and less likely to suffer from stress or burnout. Over time, this often leads to promotions and, ironically, to a higher salary than they would have earned in a job they disliked.

Nevertheless, it would be unrealistic to say that salary is not important. Many people have families to support, rent to pay or debts to repay, and for them a well-paid job may be the only responsible choice. In such cases, job satisfaction becomes a goal for the future rather than an immediate priority.

In conclusion, a high salary is attractive, but job satisfaction has a deeper and longer-lasting effect on a person's life. Ideally, people should look for work that offers both.`,
    feedback: {
      band_score: 7.5,
      grammar_score: 8,
      coherence_score: 8,
      vocabulary_score: 8,
      grammar_errors: [],
      suggestions: [
        'Name the research on income and happiness to give the claim more weight.',
        'The word "ironically" is used well; similar stance markers would enrich other paragraphs.',
        'The conclusion could end with a stronger final sentence.',
      ],
      overall_comment:
        'A mature and nuanced essay. The argument is logical, the concession is realistic and the vocabulary is precise and varied.',
    },
  },

  // ── Health ──
  {
    key: 'health-junk-food-ads',
    group: 'health',
    daysAgo: 14,
    mode: 'random',
    topic: 'Should advertising of unhealthy food be banned on television and online?',
    content: `Obesity has become a serious problem in many countries, especially among children. One of the solutions that has been proposed is to ban the advertising of unhealthy food, such as fast food, sweets and sugary drinks. I agree that such a ban, at least for advertisements aimed at children, would be a useful step.

Advertisements have a strong influence on what people eat. Food companies spend huge amounts of money on colourful adverts with famous people, cartoon characters and free toys, because they know that this increases sales. Children are particularly easy to influence, as they cannot understand that the main purpose of an advert is to make them buy something. As a result, they ask their parents for unhealthy snacks they have seen on screen.

Moreover, a ban would send a clear message that the government takes public health seriously. Similar restrictions have already been introduced for tobacco, and they helped to change attitudes towards smoking over time. Treating junk food in a similar way could encourage people to think more carefully about their diet.

Critics say that a ban limits the freedom of companies and that parents, not governments, are responsible for what children eat. While parents certainly have an important role, it is unfair to expect them to fight against a multi-billion-dollar advertising industry on their own.

In conclusion, banning the advertising of unhealthy food would not solve obesity by itself, but combined with education and healthier school meals, it could make a real difference to people's health.`,
    feedback: {
      band_score: 7.0,
      grammar_score: 8,
      coherence_score: 7,
      vocabulary_score: 7,
      grammar_errors: [],
      suggestions: [
        'The tobacco comparison is strong; add one sentence on its measured effect.',
        'The scope "at least for advertisements aimed at children" could be kept consistent in the conclusion.',
        'Avoid repeating "unhealthy"; use synonyms such as "high in sugar and fat".',
      ],
      overall_comment:
        'A clear, well-supported argument with a fair treatment of the opposing view. Language is accurate and appropriate for an academic essay.',
    },
  },
  {
    key: 'health-sugar-tax',
    group: 'health',
    daysAgo: 2,
    mode: 'predetermined',
    topic: 'Some governments put a special tax on sugary drinks. Is this a good way to improve public health?',
    content: `Sugary drinks such as cola and energy drinks are one of the main sources of added sugar in modern diets. To reduce their consumption, several governments have introduced a special tax on these products. In my opinion, a sugar tax is a good way to improve public health, although it should not be the only measure.

The most obvious effect of a tax is that sugary drinks become more expensive, so people buy fewer of them. Studies from countries such as Mexico and the United Kingdom found that consumption fell after the tax was introduced. Since too much sugar is linked to obesity, diabetes and tooth decay, even a small reduction can lead to large health benefits across the whole population.

Another positive effect is that companies change their products. In the United Kingdom, many drink producers reduced the amount of sugar in their recipes to avoid paying the tax. This means that people consume less sugar without having to change their habits at all.

However, some people argue that the tax is unfair to poorer families, who spend a larger part of their income on food and drink. This is a valid concern, and for this reason the money collected from the tax should be spent on programmes that help these families, for example free fruit in schools or sports facilities in poorer areas.

In conclusion, a tax on sugary drinks reduces consumption and encourages healthier products, so it can improve public health, especially if the income is used to support healthier lifestyles.`,
    feedback: null,
  },

  // ── Unrelated topics ──
  {
    key: 'misc-space-exploration',
    group: 'space',
    daysAgo: 24,
    mode: 'random',
    topic: 'Is space exploration worth the cost?',
    content: `Every year, governments and private companies spend billions of dollars on rockets, satellites and missions to the Moon and Mars. Some people believe this money would be better spent on problems on Earth, such as poverty and hunger. Although I understand this view, I believe that space exploration is worth its cost.

Firstly, space research has produced many technologies that we use every day. Satellite navigation, weather forecasts and global communication all depend on satellites. Inventions originally developed for astronauts, such as better water filters and medical imaging tools, are now used in homes and hospitals around the world. Without investment in space, many of these developments would not exist.

Secondly, exploring space helps us understand our own planet. Satellites monitor melting ice, forest fires and rising sea levels, providing scientists with data that is essential for understanding climate change. In this way, money spent on space can directly help to solve problems on Earth.

Finally, space exploration inspires people. When a rover lands on Mars or a telescope sends back images of distant galaxies, millions of young people become interested in science and engineering. This curiosity drives progress in many other areas.

It is true that the budgets are large and that many people on Earth still lack basic necessities. However, space spending is a very small part of most national budgets, and cutting it would not solve these problems. In conclusion, the practical and scientific benefits of space exploration make it a worthwhile investment.`,
    feedback: {
      band_score: 6.5,
      grammar_score: 7,
      coherence_score: 7,
      vocabulary_score: 6,
      grammar_errors: [
        {
          word: 'data that is essential',
          suggestion: 'data that are essential',
          explanation: 'In formal academic writing "data" is often treated as plural; both are accepted, but be consistent.',
        },
      ],
      suggestions: [
        'Give the share of a national budget spent on space to support the final paragraph.',
        'The "Firstly / Secondly / Finally" structure is clear but mechanical; vary the transitions.',
        'Develop the counter-argument earlier instead of leaving it to the conclusion.',
      ],
      overall_comment:
        'A well-structured essay with relevant examples. The opposing view is addressed briefly; giving it more space would make the essay more balanced.',
    },
  },
  {
    key: 'misc-zoos',
    group: 'zoos',
    daysAgo: 12,
    mode: 'random',
    topic: 'Zoos should be closed because keeping animals in cages is cruel. Do you agree or disagree?',
    content: `Zoos have existed for centuries, and they remain popular with families and school groups. However, many people now question whether it is right to keep wild animals in captivity. In my opinion, zoos should not be closed, but they must change so that animal welfare comes first.

There is no doubt that some zoos treat animals badly. Large animals such as elephants and polar bears need huge areas to move around, and in small enclosures they often show signs of stress, such as walking in circles for hours. Zoos like these exist mainly to entertain visitors and make money, and it is difficult to defend them.

On the other hand, modern zoos play an important role in protecting endangered species. Through breeding programmes, they have saved animals such as the Arabian oryx and the California condor, which had almost disappeared in the wild. Zoos also fund research and conservation projects in the animals' natural habitats.

Furthermore, zoos give people, especially children, the chance to see wild animals with their own eyes. This experience can create a lifelong interest in nature and encourage people to support conservation. A documentary on television rarely has the same effect as seeing a real tiger.

In conclusion, rather than closing all zoos, governments should introduce strict standards for the size of enclosures and the care of animals, and close only those zoos that cannot meet them. In this way, zoos can continue their valuable work without causing unnecessary suffering.`,
    feedback: {
      band_score: 6.0,
      grammar_score: 7,
      coherence_score: 6,
      vocabulary_score: 6,
      grammar_errors: [
        {
          word: 'Zoos like these exist mainly to entertain visitors',
          suggestion: 'Such zoos exist mainly to entertain visitors',
          explanation: '"Such zoos" is more concise and more formal.',
        },
      ],
      suggestions: [
        'The essay disagrees with the statement; make this explicit in the introduction.',
        'Use more varied vocabulary for "animals" and "zoos" to avoid repetition.',
        'The paragraph about children could be linked more clearly to conservation.',
      ],
      overall_comment:
        'A reasonable position supported by good examples of conservation. Some repetition and a slightly unclear thesis keep the score in the middle range.',
    },
  },
]

export const EMAILS = [
  {
    key: 'email-extension',
    scenario_id: 'extension-request',
    category: 'academic',
    title_tr: 'Ödev/Proje Süre Uzatma Talebi',
    to: 'prof.elena.marsh@university.edu',
    subject: 'Extension Request for Research Paper',
    daysAgo: 21,
    body: `Dear Professor Marsh,

I hope you are doing well. I am writing to ask whether it would be possible to have a short extension on my research paper for Environmental Policy, which is due this Friday.

Last week I had the flu and was unable to work for four days, so I am behind on the final section of my analysis. I have already finished the literature review and most of the data chapter, and I would like to submit a complete and careful paper rather than a rushed one.

Would it be acceptable to submit the paper next Tuesday, the 18th? I would be happy to send you my current draft if that helps.

Thank you very much for your understanding and for considering my request.

Best regards,
Deniz Kaya
Student ID: 20231457`,
    analysis: {
      scores: { task_fulfillment: 5, organization_flow: 4.5, language_grammar: 4.5, tone_register: 5 },
      comments: {
        task_fulfillment: 'Gerekçe, yeni tarih ve teşekkür olmak üzere istenen üç unsurun hepsi var.',
        organization_flow: 'Açılış, gerekçe, talep ve kapanış mantıklı bir sırada ilerliyor.',
        language_grammar: 'Dil doğru ve akıcı; birkaç cümle daha kısa ve net yazılabilir.',
        tone_register: 'Profesöre uygun, saygılı ve resmi bir ton kullanılmış.',
      },
      overall_score: 5,
      strengths: ['Somut yeni teslim tarihi önerilmiş', 'Taslak gönderme teklifi işbirliğine açık olduğunu gösteriyor'],
      improvements: [
        'Hastalık için doktor raporu olup olmadığını belirtmek talebi güçlendirir',
        'İkinci paragraf biraz uzun; iki cümleye indirilebilir',
        '"I hope you are doing well" yerine daha az kalıp bir açılış denenebilir',
      ],
      overall_comment:
        'Görevi eksiksiz yerine getiren, resmi tonu doğru kuran iyi bir e-posta. Küçük kısaltmalarla daha da etkili olur.',
    },
  },
  {
    key: 'email-dorm',
    scenario_id: 'dorm-room-change',
    category: 'admin',
    title_tr: 'Yurt Oda Değişikliği Talebi',
    to: 'housing@university.edu',
    subject: 'Inquiry Concerning Dormitory Room Change Request',
    daysAgo: 10,
    body: `Hello,

My name is Deniz Kaya and I live in Building C, room 214. I want to change my room because my roommate and me have very different schedules. He studies very late at night and I have classes at 8 am, so I can not sleep well.

Can you tell me how I can apply for a room change and how long it takes? Also I want to know if there is any free room in Building A.

Thanks,
Deniz`,
    analysis: {
      scores: { task_fulfillment: 4, organization_flow: 3.5, language_grammar: 3, tone_register: 3 },
      comments: {
        task_fulfillment: 'Süreç ve süre soruluyor, gerekçe verilmiş; ek soru da görevle ilgili.',
        organization_flow: 'Kısa ve anlaşılır, ancak paragraflar arasında geçiş zayıf.',
        language_grammar: '"my roommate and me" yerine "my roommate and I", "can not" yerine "cannot" olmalı.',
        tone_register: '"Hello", "I want" ve "Thanks" resmi bir kurum için fazla gündelik.',
      },
      overall_score: 3.5,
      strengths: ['Gerekçe somut ve anlaşılır', 'Oda ve bina bilgisi verilmiş'],
      improvements: [
        '"Dear Housing Services" ile başla, "Best regards" ile bitir',
        '"I want" yerine "I would like to" kullan',
        'Özne zamirlerine dikkat et: "my roommate and I"',
      ],
      overall_comment:
        'İçerik olarak görev karşılanmış, fakat ton ve dil hataları puanı düşürüyor. Resmi kalıpları kullanarak kolayca 4.5 üstüne çıkabilir.',
    },
  },
  {
    key: 'email-maintenance',
    scenario_id: 'apartment-maintenance',
    category: 'daily',
    title_tr: 'Daire Arıza/Bakım Talebi',
    to: 'maintenance@oakridgeapartments.com',
    subject: 'Maintenance Request for Apartment 4B',
    daysAgo: 3,
    body: `Dear Maintenance Team,

I am writing to report a problem in Apartment 4B. Since last Sunday, the kitchen sink has been leaking under the cabinet, and the floor around it stays wet even after I dry it. I have placed a bowl under the pipe, but it fills up within a few hours.

Could someone come to repair it this week? I am usually at home after 3 pm on weekdays, and I am available all day on Thursday.

Thank you in advance for your help.

Kind regards,
Deniz Kaya
Apartment 4B`,
    analysis: null,
  },
]
