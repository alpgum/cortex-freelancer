# UTM Templates

Base URL: `https://cortexfreelancer.com`

## Convention

```
utm_source   = platform name (twitter, reddit, producthunt, etc.)
utm_medium   = channel type (social, email, referral, paid, cpc)
utm_campaign = campaign name (launch, waitlist, blog, etc.)
utm_content  = variant or placement (optional)
utm_term     = keyword or audience (optional, mainly for paid)
```

## Launch Day URLs

### Product Hunt
```
https://cortexfreelancer.com?utm_source=producthunt&utm_medium=referral&utm_campaign=launch
```

### Hacker News
```
https://cortexfreelancer.com?utm_source=hackernews&utm_medium=social&utm_campaign=launch
```

### Reddit
```
https://cortexfreelancer.com?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=r_freelance
https://cortexfreelancer.com?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=r_upwork
https://cortexfreelancer.com?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=r_sideproject
https://cortexfreelancer.com?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=r_startups
```

### Twitter / X
```
https://cortexfreelancer.com?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_content=thread
https://cortexfreelancer.com?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_content=bio
```

### LinkedIn
```
https://cortexfreelancer.com?utm_source=linkedin&utm_medium=social&utm_campaign=launch&utm_content=personal
https://cortexfreelancer.com?utm_source=linkedin&utm_medium=social&utm_campaign=launch&utm_content=company
```

### IndieHackers
```
https://cortexfreelancer.com?utm_source=indiehackers&utm_medium=social&utm_campaign=launch
```

### Discord / Slack Communities
```
https://cortexfreelancer.com?utm_source=discord&utm_medium=social&utm_campaign=launch
https://cortexfreelancer.com?utm_source=slack&utm_medium=social&utm_campaign=launch
```

## Email Campaigns

### Waitlist Launch Announcement
```
https://cortexfreelancer.com?utm_source=email&utm_medium=email&utm_campaign=launch&utm_content=waitlist_blast
```

### Welcome Email
```
https://cortexfreelancer.com?utm_source=email&utm_medium=email&utm_campaign=onboarding&utm_content=welcome
```

### Newsletter
```
https://cortexfreelancer.com?utm_source=email&utm_medium=email&utm_campaign=newsletter&utm_content=issue_01
```

## Ongoing Social

### Twitter Bio / Pinned Tweet
```
https://cortexfreelancer.com?utm_source=twitter&utm_medium=social&utm_campaign=evergreen&utm_content=bio
```

### LinkedIn Profile
```
https://cortexfreelancer.com?utm_source=linkedin&utm_medium=social&utm_campaign=evergreen&utm_content=profile
```

### Blog / Content Marketing
```
https://cortexfreelancer.com?utm_source=blog&utm_medium=referral&utm_campaign=content&utm_content=POST_SLUG
```

## Paid (Future)

### Google Ads
```
https://cortexfreelancer.com?utm_source=google&utm_medium=cpc&utm_campaign=CAMPAIGN_NAME&utm_term=KEYWORD
```

### Twitter Ads
```
https://cortexfreelancer.com?utm_source=twitter&utm_medium=cpc&utm_campaign=CAMPAIGN_NAME&utm_content=AD_VARIANT
```

## Notes

- Always use lowercase for all UTM values
- Use underscores (`_`) not hyphens in multi-word values
- Test links before sharing — verify they load correctly and params appear in GA4
- Track UTM performance in GA4 → Acquisition → Traffic Acquisition
