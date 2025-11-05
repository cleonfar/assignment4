# Design Changes:

1. Addition of a UserAuthentication concept  
* Originally I had hoped that each user could store their own information locally instead of on an appwide database server. I thought by doing this I could avoid the extra complexity of a UserAuthentication concept and instead focus on concepts more related to the app’s functionality. Since the app doesn’t include features involving interaction between users I thought it could be an acceptable tradeoff to avoid the inclusion of user logic.  
* The primary driver for me to add the UserAuthentication concept was necessity. With the database structure the app uses, the only way that I saw to contain each user’s information to only be accessible to them was adding a UserAuthentication concept and including some notion of a user in the app.   
* Though I added the UserAuthentication concept mostly out of necessity, reflecting on it I think it was a good design change. It adds the ability for users to login on different devices, which adds a degree of flexibility to where and how a user interacts with the app. For example, when weighing animals a user may want the ability to quickly log weights on their phone as they go, but then afterwards they may want to sit down at the computer to view the weight report, which wouldn’t have been possible for them with my original plan for the app.
2. Concept Refactoring  
* In my original design for assignment 2, there was a concept for making growth records, another for making reproduction records, and a third for data analysis, which was intended for making reports and analysis for the records from the other two concepts. I quickly realized though that this was not modular and made the concepts very interdependent, so I refactored the concepts into a GrowthTracking concept and a ReproductionTracking concept, which both incorporated some of the data analysis actions from that concept into the original growth the reproduction recording concepts.
3. State Changes
* A major change to the original design in the state information held by different concepts was I made the state of the reproduction tracking concept hold a lot more detailed information about the offspring, and removed some of the family information held in the animal identity concept. I chose to make this change so that the parent and offspring information was held closer to where it was interacted with. Overall I feel this was a good change, but I do think in a way it weakened the animal identity concept, to the point where while I still believe it is useful it feels less necessary than I originally anticipated.
4. Action Changes
* There were plenty of action changes across the concepts. None that really altered the intended way for the concept to be used, just plenty of cases where I realized during implementation that a concept needed to be able to do something I hadn’t originally considered.

# Here is a link to my original concept specs  
[text](../context/documents/originalConcepts.md/steps/_.93dd01c0.md)

# Here are links to my final concept specs  
* Animal Identity  
[text](../context/design/concepts/AnimalIdentity/concept.md/steps/concept.9456909d.md)  

* Growth Tracking  
[text](../context/design/concepts/GrowthTracking/concept.md/steps/_.5a648e2b.md)  

* Grouping  
[text](../context/design/concepts/Group/concept.md/steps/_.0bd7ea3d.md)  

* Reproduction Tracking  
[text](<../context/design/concepts/ReproductionTracking/concept.md/steps/Updated Concept.5f64bfe7.md>)  

* User Authentication  
[text](../context/design/concepts/UserAuthentication/concept.md/steps/_.8e679b72.md)  