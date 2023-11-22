const AWS = require('aws-sdk');

const INSTANCE_SETTINGS = [
    {
        id: '<replace_instance_id>',
        name: '<desired_ami_name>',
        region: '<define_region>'
    }
];

exports.handler = async function (event, context) {
    const DateToday = new Date();
    const date = DateToday.toISOString();
    const timestamp = date.substr(0, 10);
    console.log('Today: ', timestamp);

    const DatePrevious = new Date();
    DatePrevious.setDate(DatePrevious.getDate() - 7) #no of retention days
    const dateprev = DatePrevious.toISOString();
    const timestamp_prev = dateprev.substr(0, 10);
    console.log('<br>30 days ago was: ', timestamp_prev);

    const sns = new AWS.SNS(); // Initialize SNS

    for (let index = 0; index < INSTANCE_SETTINGS.length; index++) {
        const ec2 = new AWS.EC2({
            apiVersion: '2016-11-15',
            region: INSTANCE_SETTINGS[index].region,
        });

        const ImageNameString = `ami-${INSTANCE_SETTINGS[index].name}-${timestamp}`;
        const params = {
            Description: "Created from Lambda",
            InstanceId: INSTANCE_SETTINGS[index].id,
            Name: ImageNameString,
            NoReboot: true,
        };
        try {
            const data0 = await ec2.createImage(params).promise();
            console.log(data0);

            // Send SNS notification after AMI creation
            const snsParams = {
                Message: `AMI (${data0.ImageId}) of ${INSTANCE_SETTINGS[index].name} (${INSTANCE_SETTINGS[index].id}) has been created with a 1 day of retention policy.`,
                Subject: 'AMI Creation Notification',
                TopicArn: '<replace_sns_arn>', // Replace with your SNS Topic ARN
            };

            await sns.publish(snsParams).promise();
            console.log('SNS notification sent');
        } catch (err) {
            console.error(err, err.stack);
        }

        const ImageNameToDelete = `ami-${INSTANCE_SETTINGS[index].name}-${timestamp_prev}`;
        console.log("Image name to delete : ", ImageNameToDelete);

        const paramsToDelete = {
            Filters: [
                {
                    Name: 'name',
                    Values: [ImageNameToDelete],
                }
            ],
            Owners: ['self']
        };

        try {
            const data = await ec2.describeImages(paramsToDelete).promise();
            if (data.Images.length > 0) {
                const newec2 = new AWS.EC2({
                    apiVersion: '2016-11-15',
                    region: INSTANCE_SETTINGS[index].region,
                });

                await newec2.deregisterImage({ ImageId: data.Images[0].ImageId }).promise();
                console.log("SUCCESS");
            }
        } catch (err) {
            console.error(err, err.stack);
        }
    }
};
