export const mockedDailyEvents = [
  /**
   * Newer than 30 days
   */
  {
    groupHash: '009450ef746be698e12c20e92f141f5ce7513b623ae3b3d77ec1fa8a480cff53',
    groupingTimestamp: 1585861200,
    count: 1,
    lastRepetitionTime: 1585861619,
  },
  {
    groupHash: '96c9434b18871d65e64dcb26f70e15f8c91579e90c3fd749b2051185708c5c10',
    groupingTimestamp: 1585774800,
    count: 1,
    lastRepetitionTime: 1585856860,
  },
  {
    groupHash: '80e10e84389e5d7ed95ca4eb8f7c4b0f1d634f71dbfc1d6c8c0a39b6a2702bfd',
    groupingTimestamp: 1585774800,
    count: 6,
    lastRepetitionTime: 1585854237,
  },
  {
    groupHash: '5dc4887740aaff7e76d00df8507bf132b57a61b612647c2e34c37a1905e4c28f',
    groupingTimestamp: 1586725200,
    count: 3,
    lastRepetitionTime: 1586795216,
  },
  {
    groupHash: 'ddb212ebf669c0a4d92bab79ef4da7cbdec1f4dad88cd0ad94d1684b337b95f4',
    groupingTimestamp: 1586725200,
    count: 2,
    lastRepetitionTime: 1586792852,
  },
  {
    groupHash: 'bd167a679553ac5797708750548a45c28ad5895ba1c1865bb161716fb8514510',
    groupingTimestamp: 1586725200,
    count: 5,
    lastRepetitionTime: 1586795204,
  },
  {
    groupHash: 'ade987831d0d0d167aeea685b49db164eb4e113fd027858eef7f69d049357f62',
    groupingTimestamp: 1586725200,
    count: 3,
    lastRepetitionTime: 1586792877,
  },
  {
    groupHash: '881bd5ca1a517421a17620eec325ff33572d825620782862584d06b1b30a3e72',
    groupingTimestamp: 1586725200,
    count: 2,
    lastRepetitionTime: 1586790894,
  },
  {
    groupHash: 'd17c982906d09d04ad67ce04902f729906697aeafce0adcef840231d710c28d5',
    groupingTimestamp: 1586725200,
    count: 10,
    lastRepetitionTime: 1586795393,
  },
  {
    groupHash: '69f2e24370ee5159aeaccf835d86d233f3313074faa7aac43267a4e18a0b6bc9',
    groupingTimestamp: 1586725200,
    count: 1,
    lastRepetitionTime: 1586790871,
  },
  /**
   * Older than 30 days
   */
  {
    groupHash: '14b86d7afd3a4e8faba23faeed4b2587d1404528944616a2b8dee7d8a6bd6a38',
    count: 5,
    groupingTimestamp: 1583528400,
    lastRepetitionTime: 1583577582.483,
  },
  {
    groupHash: '5f24dd5d6be4226e846383e015fd976affcee9f02eaa1d5cafc7d48710a9dfe7',
    count: 1,
    groupingTimestamp: 1583442000,
    lastRepetitionTime: 1583494343.663,
  },
  {
    groupHash: '3e980313a7262b728e11feff38dc090e6187b379ea9fc7861506d122d3e5ccf2',
    count: 3,
    groupingTimestamp: 1583442000,
    lastRepetitionTime: 1583510782.889,
  },
  {
    groupHash: '5c9e6da01f91bb4b0a9d32acd862c23584a1ef037083d75f37a386a8a0275685',
    count: 3,
    groupingTimestamp: 1582923600,
    lastRepetitionTime: 1582998025.837,
  },
  {
    groupHash: '1143a799caa8f596740ed3741d280bbf6bac614797fc4e0e3cc628f218bab8ca',
    groupingTimestamp: 1585602000,
    count: 9,
    lastRepetitionTime: 1585664182,
  },
  {
    groupHash: '0e69096ae18dffb3128ccebbee103ad78ef755160ba25ae4dcbf3d1285f30590',
    groupingTimestamp: 1585602000,
    count: 1,
    lastRepetitionTime: 1585643607,
  },
  {
    groupHash: 'ce59309fb0976b294fceaf0d132b0b5e05def0e70a35e7e328e35953248a2b64',
    groupingTimestamp: 1585515600,
    count: 2,
    lastRepetitionTime: 1585592230,
  },
  {
    groupHash: '6c59197338205460a0cb0bdfbe2c3bae6e575ab361c81b2e93bd91ce49646fde',
    groupingTimestamp: 1585515600,
    count: 2,
    lastRepetitionTime: 1585592230,
  },
];

const NEW_DAILY_EVENTS_COUNT = 10;

export const newDailyEvents = mockedDailyEvents.slice(0, NEW_DAILY_EVENTS_COUNT);
export const oldDailyEvents = mockedDailyEvents.slice(NEW_DAILY_EVENTS_COUNT);
