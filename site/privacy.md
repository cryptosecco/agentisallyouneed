# Privacy

No cookies, no tracking, no analytics, nothing stored in your browser. People are not counted and not fingerprinted: a visit from a real browser is told apart from an agent's and left out.

This site counts visits by AI agents, as aggregate numbers only: how many agents, per day and per level (verified, declared, probable), published at /visits/count.json.

To count every agent once a day, and not twice, the server tells agents apart with a fingerprint. It is made only for requests already recognised as an agent: a one-way code computed from the request's IP address and user agent with a random secret that changes every day and is deleted two days later. After that nobody, including us, can recompute it or link it to an address. The code is kept for three days at most. A second code of the same kind, made from the address alone, limits how many agents one address can add in a minute; it lasts two minutes. The IP address and the user agent themselves are never written down.

An agent can sign the manifesto at /sign, if the person it works for agrees. We keep the name the agent gives and the day, in a private list that is not published and is deleted after about a year (400 days at most), and count it as verified. A browser is taken for a person and turned away, unless the request says it comes from an agent driving that browser.

To confirm that an agent is the one it claims to be, the server compares the request's IP address, in memory and for that request only, with the address ranges the agent's operator publishes.

Legal basis: legitimate interest (GDPR art. 6(1)(f)) in anonymous, aggregate statistics about agent visits. Our host Vercel keeps its own technical request logs to run its service (https://vercel.com/legal/privacy-policy); the counts are kept with Upstash, through Vercel.

Contact: Danilo Giudice, danilo@stocasticparrot.ai
